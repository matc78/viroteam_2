import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import { dedupeInFlight } from "./dedupeInFlight";
import { Collections, Fields, MemberRoles } from "./constants";
import { getClub } from "./clubService";
import { toDate } from "./types";
import { resolveSeasonEndDate } from "@/lib/planning/seasonEnd";
import {
  audienceMapKeys,
  buildAudienceMapsPatch,
  buildCanonicalByAnyId,
  excludedCanonicalIds,
  isAudienceIdExcluded,
  planAudienceSync,
  type AudienceAliasPair,
  type AudienceKeyedMaps,
} from "@/lib/planning/audienceAliasSync";
import {
  appendClubActivityToBatch,
  ClubActivityTypes,
} from "./activityService";

/** Champ map d'un document event, ou `{}` s'il est absent / invalide. */
function objectField(
  data: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  const value = data[field];
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

/** Champ tableau de chaînes d'un document event, ou `[]`. */
function stringArrayField(
  data: Record<string, unknown>,
  field: string,
): string[] {
  const value = data[field];
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

/** Types d'événements club (aligné EventTypes Flutter). */
export type EventType = "training" | "match" | "tournament" | "meeting" | "other";

/** Fenêtre planning à venir — alignée EventService Flutter. */
export const UPCOMING_PLANNING_HORIZON_DAYS = 14;

/** Limite d'aperçu sur la home dashboard. */
export const HOME_PREVIEW_EVENT_LIMIT = 6;

/** Vue événement pour le portail admin. */
export type ClubEventView = {
  id: string;
  title: string;
  type: EventType;
  startsAt: string;
  /** Fin estimée (endTime Firestore, sinon début + 75 min). */
  endsAt: string;
  dateId: string;
  location: string;
  teamIds: string[];
  teamLabels: string[];
  /** Audience RSVP / joueurs convoqués. */
  teamMemberIds: string[];
  /** Joueurs retirés des convoqués (invisibles pour eux, jamais réintégrés par la synchro). */
  excludedMemberIds: string[];
  /** Série récurrente (un doc par occurrence), sinon null. */
  seriesId: string | null;
  /** Map memberId → yes | maybe | no. */
  rsvpByMemberId: Record<string, string>;
  rsvpYes: number;
  rsvpNo: number;
  rsvpPending: number;
  rsvpTotal: number;
};

/** Alias conservé pour la home dashboard. */
export type UpcomingEvent = ClubEventView;

export type TeamOption = {
  id: string;
  name: string;
  category: string;
  /** Identifiants roster joueurs (pour `teamMemberIds` à la création). */
  playerIds: string[];
  coachIds: string[];
};

/** Membre club pour filtres planning et invités (coach / joueur / admin). */
export type PlanningPersonOption = {
  id: string;
  /** Identifiants possibles (memberId, accountUid) pour matcher les rosters. */
  matchIds: string[];
  name: string;
  role: "coach" | "player" | "admin" | "other";
  avatarUrl: string | null;
};

/** Entrée annuaire pour la liste RSVP du popover événement. */
export type PlanningGuestDirectoryEntry = {
  name: string;
  avatarUrl: string | null;
};

export type PlanningPageData = {
  events: ClubEventView[];
  teams: TeamOption[];
  coaches: PlanningPersonOption[];
  players: PlanningPersonOption[];
  /** Admins du club (invités « Autre », hors filtres sidebar). */
  admins: PlanningPersonOption[];
  categories: string[];
  /** Fin de saison résolue (club ou défaut 30 juin). */
  seasonEndDate: Date;
};

/** Payload de création d'événement (aligné EventService Flutter). */
export type CreateClubEventInput = {
  clubId: string;
  creatorId: string;
  type: EventType;
  title: string;
  startDate: Date;
  teamIds: string[];
  teamMemberIds: string[];
  /**
   * Joueurs retirés des convoqués (match : décochés à la création).
   * Retirés de `teamMemberIds` ; champ omis si vide.
   */
  excludedMemberIds?: string[];
  location: string;
  startTime: string;
  endTime?: string;
  meetingTime?: string;
  matchVenue?: "home" | "away";
  allTeams?: boolean;
  /** Fin de récurrence hebdomadaire (aligné Flutter, max 52 occurrences). */
  recurrenceEndDate?: Date | null;
  /** Rappel push 7 jours avant (event important : tournoi, AG…). */
  importantReminder?: boolean;
};

/** Rappel J-7 coché d'office : un tournoi ou une réunion se prépare plus tôt. */
export function importantReminderByDefault(type: EventType): boolean {
  return type === "tournament" || type === "meeting";
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  training: "Entraînement",
  match: "Match",
  tournament: "Tournoi",
  meeting: "Réunion",
  other: "Autre",
};

/** Libellé français du type d'événement. */
export function eventTypeLabel(type: EventType): string {
  return EVENT_TYPE_LABELS[type];
}

/** Formate une date en identifiant Firestore `dateId` (YYYYMMDD). */
export function formatDateId(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/** Date locale sans heure. */
export function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Jour calendaire d'un événement (minuit local), indépendant du fuseau du
 * navigateur : `dateId` d'abord, sinon jour UTC le plus proche du timestamp
 * (écriture actuelle = minuit UTC, legacy = minuit Europe → 22h/23h UTC la veille).
 * Miroir de `ClubEvent.calendarDateFromFirestore` côté app.
 */
export function eventCalendarDate(data: Record<string, unknown>): Date | null {
  const dateId = data[Fields.dateId];
  if (typeof dateId === "string" && /^\d{8}$/.test(dateId)) {
    return new Date(
      Number(dateId.slice(0, 4)),
      Number(dateId.slice(4, 6)) - 1,
      Number(dateId.slice(6, 8)),
    );
  }
  const stored = toDate(data[Fields.date]);
  if (!stored) {
    const start = toDate(data[Fields.startTime]);
    return start ? dateOnly(start) : null;
  }
  const roundUp = stored.getUTCHours() >= 12 ? 1 : 0;
  return new Date(
    stored.getUTCFullYear(),
    stored.getUTCMonth(),
    stored.getUTCDate() + roundUp,
  );
}

/** Fusionne une date calendaire avec une heure `HH:mm`. */
export function combineDateAndTime(date: Date, time?: string | null): Date {
  const result = dateOnly(date);
  if (!time) return result;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return result;
  result.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return result;
}

/** Vérifie si une date est dans la fenêtre planning à venir. */
export function isWithinUpcomingPlanningWindow(
  eventDate: Date,
  clock = new Date(),
): boolean {
  const today = dateOnly(clock);
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + UPCOMING_PLANNING_HORIZON_DAYS);
  const day = dateOnly(eventDate);
  return day.getTime() >= today.getTime() && day.getTime() <= horizonEnd.getTime();
}

function parseEventType(raw: unknown): EventType {
  const value = String(raw ?? "other");
  if (
    value === "training" ||
    value === "match" ||
    value === "tournament" ||
    value === "meeting" ||
    value === "other"
  ) {
    return value;
  }
  return "other";
}

function parseRsvpMap(data: Record<string, unknown>): Record<string, string> {
  const rsvpRaw = data[Fields.rsvp];
  if (!rsvpRaw || typeof rsvpRaw !== "object") return {};
  const result: Record<string, string> = {};
  for (const [memberId, value] of Object.entries(
    rsvpRaw as Record<string, unknown>,
  )) {
    if (typeof value === "string" && value.trim()) {
      result[memberId] = value;
    }
  }
  return result;
}

function parseRsvpCounts(data: Record<string, unknown>): {
  rsvpYes: number;
  rsvpNo: number;
  rsvpPending: number;
  rsvpTotal: number;
  rsvpByMemberId: Record<string, string>;
} {
  const rsvp = parseRsvpMap(data);
  const values = Object.values(rsvp);
  const rsvpYes = values.filter((value) => value === "yes").length;
  const rsvpNo = values.filter((value) => value === "no").length;
  const teamMemberIds = Array.isArray(data[Fields.teamMemberIds])
    ? (data[Fields.teamMemberIds] as unknown[]).map(String)
    : [];
  const rsvpTotal =
    teamMemberIds.length > 0 ? teamMemberIds.length : values.length;
  const rsvpPending = Math.max(0, rsvpTotal - rsvpYes - rsvpNo);

  return { rsvpYes, rsvpNo, rsvpPending, rsvpTotal, rsvpByMemberId: rsvp };
}

/** Parse un document Firestore events en vue portail. */
export function parseClubEvent(
  id: string,
  data: Record<string, unknown>,
  teamNameById: Map<string, string> = new Map(),
): ClubEventView | null {
  if (data[Fields.canceled] === true) return null;
  const eventDate = eventCalendarDate(data);
  if (!eventDate) return null;

  const teamIds = Array.isArray(data[Fields.teamIds])
    ? (data[Fields.teamIds] as unknown[]).map(String)
    : [];
  const teamLabels =
    teamIds.length > 0
      ? teamIds.map((teamId) => teamNameById.get(teamId) ?? "Équipe")
      : ["Club"];

  const { rsvpYes, rsvpNo, rsvpPending, rsvpTotal, rsvpByMemberId } =
    parseRsvpCounts(data);
  const dateId =
    typeof data[Fields.dateId] === "string" && data[Fields.dateId]
      ? String(data[Fields.dateId])
      : formatDateId(eventDate);
  const startTimeRaw = data[Fields.startTime];
  const startTime =
    typeof startTimeRaw === "string" && startTimeRaw.trim()
      ? startTimeRaw.trim()
      : null;
  const endTimeRaw = data[Fields.endTime];
  const endTime =
    typeof endTimeRaw === "string" && endTimeRaw.trim()
      ? endTimeRaw.trim()
      : null;
  const startsAtDate = combineDateAndTime(eventDate, startTime);
  const endsAtDate = endTime
    ? combineDateAndTime(eventDate, endTime)
    : new Date(startsAtDate.getTime() + 75 * 60_000);
  if (endsAtDate.getTime() <= startsAtDate.getTime()) {
    endsAtDate.setTime(startsAtDate.getTime() + 75 * 60_000);
  }

  return {
    id,
    title: String(data[Fields.title] ?? "Événement"),
    type: parseEventType(data[Fields.type]),
    startsAt: startsAtDate.toISOString(),
    endsAt: endsAtDate.toISOString(),
    dateId,
    location: String(data[Fields.location] ?? ""),
    teamIds,
    teamLabels,
    teamMemberIds: stringArrayField(data, Fields.teamMemberIds),
    excludedMemberIds: stringArrayField(data, Fields.excludedMemberIds),
    seriesId:
      typeof data[Fields.seriesId] === "string" && data[Fields.seriesId]
        ? String(data[Fields.seriesId])
        : null,
    rsvpByMemberId,
    rsvpYes,
    rsvpNo,
    rsvpPending,
    rsvpTotal,
  };
}

/**
 * Charge un événement club par id (deep-link hors fenêtre calendrier).
 * Retourne null si absent ou annulé.
 */
export async function getClubEvent(
  clubId: string,
  eventId: string,
  teams: TeamOption[] = [],
): Promise<ClubEventView | null> {
  const eventDocument = doc(eventsCollection(clubId), eventId);
  const snap = await getDoc(eventDocument);
  if (!snap.exists()) return null;
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  return parseClubEvent(
    snap.id,
    snap.data() as Record<string, unknown>,
    teamNameById,
  );
}

/** Charge les équipes d'un club pour résoudre les libellés. */
export async function loadTeamsForClub(clubId: string): Promise<TeamOption[]> {
  // Appels concurrents (plusieurs loaders d’une page) : une seule requête.
  const teams = await dedupeInFlight(`teams:${clubId}`, () =>
    queryTeamsForClub(clubId),
  );
  return [...teams];
}

async function queryTeamsForClub(clubId: string): Promise<TeamOption[]> {
  const teamsCol = collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.teams,
  );
  const snap = await getDocs(query(teamsCol, limit(80)));
  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const playerIdsRaw = data[Fields.playerIds];
      const coachIdsRaw = data[Fields.coachIds];
      const playerIds = Array.isArray(playerIdsRaw)
        ? playerIdsRaw.map(String)
        : [];
      const coachIds = Array.isArray(coachIdsRaw)
        ? coachIdsRaw.map(String)
        : [];
      const category =
        typeof data[Fields.category] === "string"
          ? String(data[Fields.category]).trim()
          : "";
      return {
        id: docSnap.id,
        name: String(data[Fields.name] ?? "Équipe"),
        category,
        playerIds,
        coachIds,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Charge les membres du club pour les filtres coach / joueur. */
export async function loadPlanningPeopleForClub(
  clubId: string,
): Promise<PlanningPersonOption[]> {
  const membersCol = collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.members,
  );
  const snap = await getDocs(query(membersCol, limit(300)));
  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const firstName = String(data[Fields.firstName] ?? "").trim();
      const lastName = String(data[Fields.lastName] ?? "").trim();
      const displayName = String(data[Fields.displayName] ?? "").trim();
      const name =
        [firstName, lastName].filter(Boolean).join(" ") ||
        displayName ||
        "Membre";
      const accountUid = String(data[Fields.accountUid] ?? "").trim();
      const matchIds = Array.from(
        new Set([docSnap.id, accountUid].filter(Boolean)),
      );
      const roleRaw = String(data[Fields.role] ?? "");
      const role =
        roleRaw === MemberRoles.coach ||
        roleRaw === MemberRoles.player ||
        roleRaw === MemberRoles.admin
          ? roleRaw
          : "other";
      const snapshot =
        (data[Fields.snapshot] as Record<string, unknown> | undefined) ?? {};
      const avatarRaw = snapshot[Fields.avatarUrl];
      const avatarUrl =
        typeof avatarRaw === "string" ? avatarRaw.trim() || null : null;
      return {
        id: docSnap.id,
        matchIds,
        name,
        role,
        avatarUrl,
      } satisfies PlanningPersonOption;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Construit les dates de récurrence hebdomadaire (max 52). */
function buildRecurrenceDates(
  startDate: Date,
  recurrenceEndDate?: Date | null,
): Date[] {
  const start = dateOnly(startDate);
  if (!recurrenceEndDate) return [start];
  const end = dateOnly(recurrenceEndDate);
  if (end.getTime() < start.getTime()) return [start];

  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime() && dates.length < 52) {
    dates.push(dateOnly(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates.length > 0 ? dates : [start];
}

/**
 * Crée un ou plusieurs événements club (récurrence hebdo optionnelle).
 * Retourne le nombre d'événements créés.
 */
export async function createClubEvent(
  input: CreateClubEventInput,
): Promise<number> {
  const dates = buildRecurrenceDates(
    input.startDate,
    input.recurrenceEndDate,
  );
  const eventsCol = eventsCollection(input.clubId);
  const batch = writeBatch(getAppFirestore());
  const seriesId = dates.length > 1 ? doc(eventsCol).id : null;
  const excludedMemberIds = [
    ...new Set((input.excludedMemberIds ?? []).filter(Boolean)),
  ];
  const excludedSet = new Set(excludedMemberIds);
  const teamMemberIds = input.teamMemberIds.filter(
    (id) => !excludedSet.has(id),
  );

  for (const day of dates) {
    const eventRef = doc(eventsCol);
    const payload: Record<string, unknown> = {
      [Fields.type]: input.type,
      [Fields.title]: input.title,
      [Fields.location]: input.location,
      [Fields.teamIds]: input.teamIds,
      [Fields.allTeams]: input.allTeams ?? false,
      [Fields.date]: Timestamp.fromDate(
        new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())),
      ),
      [Fields.dateId]: formatDateId(day),
      [Fields.startTime]: input.startTime,
      [Fields.teamMemberIds]: teamMemberIds,
      [Fields.rsvp]: {},
      [Fields.attendance]: {},
      [Fields.creatorId]: input.creatorId,
      [Fields.canceled]: false,
      [Fields.createdAt]: serverTimestamp(),
    };
    if (input.endTime) payload[Fields.endTime] = input.endTime;
    if (input.meetingTime) payload[Fields.meetingTime] = input.meetingTime;
    if (input.matchVenue) payload[Fields.matchVenue] = input.matchVenue;
    if (seriesId) payload[Fields.seriesId] = seriesId;
    if (input.importantReminder) payload[Fields.importantReminder] = true;
    if (excludedMemberIds.length > 0) {
      payload[Fields.excludedMemberIds] = excludedMemberIds;
    }
    batch.set(eventRef, payload);
  }

  appendClubActivityToBatch(batch, input.clubId, {
    type: ClubActivityTypes.eventsCreated,
    actorUid: input.creatorId,
    count: dates.length,
    summary: input.title,
  });

  await batch.commit();
  return dates.length;
}

/**
 * Ajoute un convoqué aux événements à venir d'une équipe
 * (aligné EventService Flutter `addAudienceToUpcomingTeamEvents`).
 * Ignore les événements où ce joueur (ou un de ses alias) a été retiré des
 * convoqués (`excludedMemberIds`).
 */
export async function addAudienceToUpcomingTeamEvents(params: {
  clubId: string;
  teamId: string;
  audienceId: string;
}): Promise<void> {
  const audienceId = params.audienceId.trim();
  if (!audienceId) return;

  const snap = await queryUpcomingTeamEvents(params.clubId, params.teamId);
  const hasExclusions = snap.some(
    ({ data }) => stringArrayField(data, Fields.excludedMemberIds).length > 0,
  );
  // Alias chargés seulement si un event porte des exclus (une seule requête).
  const canonicalByAnyId = hasExclusions
    ? buildCanonicalByAnyId(await loadAudienceAliasPairs(params.clubId))
    : new Map<string, string>();
  const db = getAppFirestore();
  let batch = writeBatch(db);
  let pending = 0;

  for (const docSnap of snap) {
    const data = docSnap.data;
    if (data[Fields.canceled] === true) continue;
    const members = Array.isArray(data[Fields.teamMemberIds])
      ? (data[Fields.teamMemberIds] as unknown[]).map(String)
      : [];
    if (members.includes(audienceId)) continue;
    const excluded = excludedCanonicalIds(
      stringArrayField(data, Fields.excludedMemberIds),
      canonicalByAnyId,
    );
    if (isAudienceIdExcluded(audienceId, excluded, canonicalByAnyId)) continue;

    batch.update(doc(eventsCollection(params.clubId), docSnap.id), {
      [Fields.teamMemberIds]: arrayUnion(audienceId),
    });
    pending += 1;
    if (pending >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();
}

/**
 * Retire un convoqué des événements à venir d'une équipe
 * (aligné EventService Flutter `removeAudienceFromUpcomingTeamEvents`).
 * Supprime aussi la clé RSVP pour éviter un statut orphelin.
 */
export async function removeAudienceFromUpcomingTeamEvents(params: {
  clubId: string;
  teamId: string;
  audienceId: string;
}): Promise<void> {
  const audienceId = params.audienceId.trim();
  if (!audienceId) return;

  const snap = await queryUpcomingTeamEvents(params.clubId, params.teamId);
  const db = getAppFirestore();
  let batch = writeBatch(db);
  let pending = 0;

  for (const docSnap of snap) {
    const data = docSnap.data;
    if (data[Fields.canceled] === true) continue;
    const members = Array.isArray(data[Fields.teamMemberIds])
      ? (data[Fields.teamMemberIds] as unknown[]).map(String)
      : [];
    const patch: Record<string, unknown> = {};
    if (members.includes(audienceId)) {
      patch[Fields.teamMemberIds] = arrayRemove(audienceId);
    }
    for (const field of [Fields.rsvp, Fields.rsvpUpdatedAt, Fields.seenAt]) {
      if (audienceId in objectField(data, field)) {
        patch[`${field}.${audienceId}`] = deleteField();
      }
    }
    if (Object.keys(patch).length === 0) continue;

    batch.update(doc(eventsCollection(params.clubId), docSnap.id), patch);
    pending += 1;
    if (pending >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();
}

/** Charge les paires memberId / canonicalId pour la sync audience. */
async function loadAudienceAliasPairs(
  clubId: string,
): Promise<AudienceAliasPair[]> {
  const membersCol = collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.members,
  );
  const snap = await getDocs(query(membersCol, limit(300)));
  return snap.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const accountUid = String(data[Fields.accountUid] ?? "").trim();
    return {
      memberId: docSnap.id,
      canonicalId: accountUid || docSnap.id,
    };
  });
}

/**
 * Aligne `teamMemberIds` des événements à venir sur les rosters joueurs actuels.
 * Ajoute les manquants, migre les alias legacy → uid Auth, ne retire pas les
 * invités manuels hors alias.
 * @returns nombre d’événements mis à jour.
 */
export async function syncUpcomingEventsAudienceFromTeams(
  clubId: string,
  teams: TeamOption[],
): Promise<number> {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const today = dateOnly(new Date());
  const eventsCol = eventsCollection(clubId);
  const canonicalByAnyId = buildCanonicalByAnyId(
    await loadAudienceAliasPairs(clubId),
  );

  let raw: Array<{ id: string; data: Record<string, unknown> }>;
  try {
    const snap = await getDocs(
      query(
        eventsCol,
        where(Fields.date, ">=", Timestamp.fromDate(today)),
        limit(200),
      ),
    );
    raw = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data() as Record<string, unknown>,
    }));
  } catch {
    raw = await queryUpcomingRawEvents(clubId);
  }

  const db = getAppFirestore();
  let batch = writeBatch(db);
  let pending = 0;
  let updated = 0;

  for (const { id, data } of raw) {
    if (data[Fields.canceled] === true) continue;
    const eventDate = eventCalendarDate(data);
    if (!eventDate || dateOnly(eventDate).getTime() < today.getTime()) continue;

    const eventTeamIds = Array.isArray(data[Fields.teamIds])
      ? (data[Fields.teamIds] as unknown[]).map(String)
      : [];
    if (eventTeamIds.length === 0) continue;

    const expected: string[] = [];
    for (const teamId of eventTeamIds) {
      const team = teamById.get(teamId);
      if (!team) continue;
      for (const playerId of team.playerIds) {
        if (playerId) expected.push(playerId);
      }
    }
    if (expected.length === 0) continue;

    const currentMemberIds = Array.isArray(data[Fields.teamMemberIds])
      ? (data[Fields.teamMemberIds] as unknown[]).map(String)
      : [];
    const maps: AudienceKeyedMaps = {
      rsvp: objectField(data, Fields.rsvp),
      rsvpUpdatedAt: objectField(data, Fields.rsvpUpdatedAt),
      seenAt: objectField(data, Fields.seenAt),
    };
    const plan = planAudienceSync({
      currentMemberIds,
      expectedCanonicalIds: expected,
      canonicalByAnyId,
      rsvpKeys: audienceMapKeys(maps),
      excludedMemberIds: stringArrayField(data, Fields.excludedMemberIds),
    });
    if (!plan.changed) continue;

    const patch: Record<string, unknown> = {
      [Fields.teamMemberIds]: plan.nextMemberIds,
      ...buildAudienceMapsPatch({ plan, maps, deleteField: deleteField() }),
    };

    batch.update(doc(eventsCol, id), patch);
    pending += 1;
    updated += 1;
    if (pending >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      pending = 0;
    }
  }

  if (pending > 0) await batch.commit();
  return updated;
}

/** Événements à venir d’une équipe (`date` ≥ aujourd’hui). */
async function queryUpcomingTeamEvents(
  clubId: string,
  teamId: string,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const today = dateOnly(new Date());
  const eventsCol = eventsCollection(clubId);
  try {
    const snap = await getDocs(
      query(
        eventsCol,
        where(Fields.teamIds, "array-contains", teamId),
        where(Fields.date, ">=", Timestamp.fromDate(today)),
        limit(200),
      ),
    );
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data() as Record<string, unknown>,
    }));
  } catch {
    const fallback = await queryUpcomingRawEvents(clubId);
    return fallback.filter(({ data }) => {
      const teamIds = Array.isArray(data[Fields.teamIds])
        ? (data[Fields.teamIds] as unknown[]).map(String)
        : [];
      return teamIds.includes(teamId);
    });
  }
}

function eventsCollection(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.events,
  );
}

async function queryEventsByDateIdRange(
  clubId: string,
  startDateId: string,
  endDateId: string,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const eventsCol = eventsCollection(clubId);

  try {
    const rangeQuery = query(
      eventsCol,
      where(Fields.dateId, ">=", startDateId),
      where(Fields.dateId, "<=", endDateId),
      orderBy(Fields.dateId, "asc"),
      limit(200),
    );
    const snap = await getDocs(rangeQuery);
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data() as Record<string, unknown>,
    }));
  } catch {
    try {
      const fallbackQuery = query(
        eventsCol,
        where(Fields.dateId, ">=", startDateId),
        orderBy(Fields.dateId, "asc"),
        limit(200),
      );
      const snap = await getDocs(fallbackQuery);
      return snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          data: docSnap.data() as Record<string, unknown>,
        }))
        .filter(({ data }) => {
          const dateId = String(data[Fields.dateId] ?? "");
          return dateId <= endDateId;
        });
    } catch {
      const snap = await getDocs(query(eventsCol, limit(120)));
      return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data() as Record<string, unknown>,
      }));
    }
  }
}

async function queryUpcomingRawEvents(clubId: string): Promise<
  Array<{ id: string; data: Record<string, unknown> }>
> {
  const today = dateOnly(new Date());
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + UPCOMING_PLANNING_HORIZON_DAYS);
  return queryEventsByDateIdRange(
    clubId,
    formatDateId(today),
    formatDateId(horizonEnd),
  );
}

/** Clubs dont les convocations à venir ont déjà été réparées cette session. */
const audienceRepairedClubIds = new Set<string>();

/**
 * Aligne les convocations à venir sur les rosters (répare les ajouts portail
 * sans sync), en arrière-plan et une seule fois par club et par session.
 * Réservé admin / coach (écriture events). Le listener temps réel des pages
 * recharge les données si des convocations ont été corrigées.
 */
export function scheduleUpcomingAudienceRepair(
  clubId: string,
  teams: TeamOption[],
): void {
  if (audienceRepairedClubIds.has(clubId)) return;
  audienceRepairedClubIds.add(clubId);
  void syncUpcomingEventsAudienceFromTeams(clubId, teams).catch((error) => {
    audienceRepairedClubIds.delete(clubId);
    console.warn("Réparation convocations", error);
  });
}

/**
 * Charge les événements à venir d'un club dans la fenêtre 14 jours.
 * `repairAudience` (admin / coach) : lance la réparation des convocations.
 */
export async function loadUpcomingEvents(
  clubId: string,
  options: { limit?: number; repairAudience?: boolean } = {},
): Promise<ClubEventView[]> {
  const [teams, rawEvents] = await Promise.all([
    loadTeamsForClub(clubId),
    queryUpcomingRawEvents(clubId),
  ]);
  if (options.repairAudience) scheduleUpcomingAudienceRepair(clubId, teams);
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));

  const parsed = rawEvents
    .map(({ id, data }) => parseClubEvent(id, data, teamNameById))
    .filter((event): event is ClubEventView => event !== null)
    .filter((event) => isWithinUpcomingPlanningWindow(new Date(event.startsAt)))
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  const maxItems = options.limit ?? parsed.length;
  return parsed.slice(0, maxItems);
}

/**
 * Charge des équipes par id (un `getDoc` par équipe).
 * Pour un parent : les règles n’autorisent que `teams/{teamId}` avec
 * `teamId ∈ parentTeamIds` — jamais de `getDocs(teams)`.
 * Les équipes absentes ou refusées sont ignorées.
 */
export async function loadTeamsByIds(
  clubId: string,
  teamIds: string[],
): Promise<TeamOption[]> {
  const uniqueIds = [...new Set(teamIds.map(String).filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const teamsCol = collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.teams,
  );
  const results = await Promise.all(
    uniqueIds.map(async (teamId) => {
      try {
        const snap = await getDoc(doc(teamsCol, teamId));
        if (!snap.exists()) return null;
        const data = snap.data() as Record<string, unknown>;
        const playerIdsRaw = data[Fields.playerIds];
        const coachIdsRaw = data[Fields.coachIds];
        return {
          id: snap.id,
          name: String(data[Fields.name] ?? "Équipe"),
          category:
            typeof data[Fields.category] === "string"
              ? String(data[Fields.category]).trim()
              : "",
          playerIds: Array.isArray(playerIdsRaw) ? playerIdsRaw.map(String) : [],
          coachIds: Array.isArray(coachIdsRaw) ? coachIdsRaw.map(String) : [],
        } satisfies TeamOption;
      } catch {
        // Équipe non lisible pour ce compte (règles) : on l’ignore.
        return null;
      }
    }),
  );
  return results
    .filter((team): team is TeamOption => team !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/**
 * Événements à venir d’une équipe pour un parent : uniquement
 * `where teamIds array-contains <teamId>` (seule forme autorisée par les
 * règles). Tente d’abord la requête indexée (`date >=`), sinon filtre la date
 * côté client — jamais de lecture globale des events.
 */
async function queryUpcomingTeamEventsForGuardian(
  clubId: string,
  teamId: string,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const today = dateOnly(new Date());
  const eventsCol = eventsCollection(clubId);
  try {
    const snap = await getDocs(
      query(
        eventsCol,
        where(Fields.teamIds, "array-contains", teamId),
        where(Fields.date, ">=", Timestamp.fromDate(today)),
        limit(200),
      ),
    );
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data() as Record<string, unknown>,
    }));
  } catch {
    const snap = await getDocs(
      query(
        eventsCol,
        where(Fields.teamIds, "array-contains", teamId),
        limit(300),
      ),
    );
    return snap.docs
      .map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data() as Record<string, unknown>,
      }))
      .filter(({ data }) => {
        const eventDate = eventCalendarDate(data);
        return (
          eventDate !== null &&
          dateOnly(eventDate).getTime() >= today.getTime()
        );
      });
  }
}

/**
 * Événements à venir (fenêtre 14 jours) visibles par un parent : une requête
 * par équipe de l’enfant, dédoublonnées, sans synchronisation d’audience
 * (un parent ne peut pas écrire les events).
 */
export async function loadUpcomingEventsForGuardian(
  clubId: string,
  childTeamIds: string[],
  options: { limit?: number; teams?: TeamOption[] } = {},
): Promise<ClubEventView[]> {
  const teamIds = [...new Set(childTeamIds.map(String).filter(Boolean))];
  if (teamIds.length === 0) return [];

  const teams = options.teams ?? (await loadTeamsByIds(clubId, teamIds));
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));

  const perTeam = await Promise.all(
    teamIds.map((teamId) => queryUpcomingTeamEventsForGuardian(clubId, teamId)),
  );
  const byId = new Map<string, Record<string, unknown>>();
  for (const rows of perTeam) {
    for (const { id, data } of rows) {
      if (!byId.has(id)) byId.set(id, data);
    }
  }

  const parsed = [...byId.entries()]
    .map(([id, data]) => parseClubEvent(id, data, teamNameById))
    .filter((event): event is ClubEventView => event !== null)
    .filter((event) => isWithinUpcomingPlanningWindow(new Date(event.startsAt)))
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  const maxItems = options.limit ?? parsed.length;
  return parsed.slice(0, maxItems);
}

/**
 * Events d’une équipe dans une plage de dates (parent / guardian).
 * Même contrainte règles : `teamIds array-contains` uniquement.
 */
async function queryTeamEventsInRangeForGuardian(
  clubId: string,
  teamId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const start = dateOnly(rangeStart);
  const end = dateOnly(rangeEnd);
  const eventsCol = eventsCollection(clubId);
  try {
    const snap = await getDocs(
      query(
        eventsCol,
        where(Fields.teamIds, "array-contains", teamId),
        where(Fields.date, ">=", Timestamp.fromDate(start)),
        where(Fields.date, "<=", Timestamp.fromDate(end)),
        limit(400),
      ),
    );
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data() as Record<string, unknown>,
    }));
  } catch {
    const snap = await getDocs(
      query(
        eventsCol,
        where(Fields.teamIds, "array-contains", teamId),
        limit(400),
      ),
    );
    const startMs = start.getTime();
    const endMs = end.getTime();
    return snap.docs
      .map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data() as Record<string, unknown>,
      }))
      .filter(({ data }) => {
        const eventDate = eventCalendarDate(data);
        if (!eventDate) return false;
        const dayMs = dateOnly(eventDate).getTime();
        return dayMs >= startMs && dayMs <= endMs;
      });
  }
}

/**
 * Planning calendrier parent : events des équipes enfants sur une plage,
 * une requête par équipe (pas de list globale).
 */
export async function loadPlanningEventsForGuardian(
  clubId: string,
  childTeamIds: string[],
  options: { start: Date; end: Date; teams?: TeamOption[] },
): Promise<{ events: ClubEventView[]; teams: TeamOption[] }> {
  const teamIds = [...new Set(childTeamIds.map(String).filter(Boolean))];
  if (teamIds.length === 0) {
    return { events: [], teams: [] };
  }

  const teams = options.teams ?? (await loadTeamsByIds(clubId, teamIds));
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const start = dateOnly(options.start);
  const end = dateOnly(options.end);

  const perTeam = await Promise.all(
    teamIds.map((teamId) =>
      queryTeamEventsInRangeForGuardian(clubId, teamId, start, end),
    ),
  );
  const byId = new Map<string, Record<string, unknown>>();
  for (const rows of perTeam) {
    for (const { id, data } of rows) {
      if (!byId.has(id)) byId.set(id, data);
    }
  }

  const startMs = start.getTime();
  const endMs = end.getTime();
  const events = [...byId.entries()]
    .map(([id, data]) => parseClubEvent(id, data, teamNameById))
    .filter((event): event is ClubEventView => event !== null)
    .filter((event) => {
      const dayMs = dateOnly(new Date(event.startsAt)).getTime();
      return dayMs >= startMs && dayMs <= endMs;
    })
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  return { events, teams };
}

/** Charge les données complètes de la page planning (plage calendrier élargie). */
export async function loadPlanningPageData(
  clubId: string,
  options: { start?: Date; end?: Date } = {},
): Promise<PlanningPageData> {
  const [teams, people, club] = await Promise.all([
    loadTeamsForClub(clubId),
    loadPlanningPeopleForClub(clubId),
    getClub(clubId),
  ]);
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const seasonEndDate = resolveSeasonEndDate(club?.seasonEndDate ?? null);

  const start =
    options.start ??
    (() => {
      const today = dateOnly(new Date());
      return new Date(today.getFullYear(), today.getMonth() - 1, 1);
    })();
  const end =
    options.end ??
    (() => {
      const today = dateOnly(new Date());
      return new Date(today.getFullYear(), today.getMonth() + 2, 0);
    })();

  const rawEvents = await queryEventsByDateIdRange(
    clubId,
    formatDateId(dateOnly(start)),
    formatDateId(dateOnly(end)),
  );

  const startMs = dateOnly(start).getTime();
  const endMs = dateOnly(end).getTime();

  const events = rawEvents
    .map(({ id, data }) => parseClubEvent(id, data, teamNameById))
    .filter((event): event is ClubEventView => event !== null)
    .filter((event) => {
      const dayMs = dateOnly(new Date(event.startsAt)).getTime();
      return dayMs >= startMs && dayMs <= endMs;
    })
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  const { coaches, players } = splitPlanningPeopleByRoster(people, teams);
  const admins = people.filter((person) => person.role === "admin");
  const categories = Array.from(
    new Set(
      teams
        .map((team) => team.category)
        .filter((category) => category.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "fr"));

  return {
    events,
    teams,
    coaches,
    players,
    admins,
    categories,
    seasonEndDate,
  };
}

/**
 * Sépare coachs / joueurs à partir des rosters d’équipes (prioritaire),
 * puis complète avec le rôle club pour les membres hors roster.
 */
function splitPlanningPeopleByRoster(
  people: PlanningPersonOption[],
  teams: TeamOption[],
): {
  coaches: PlanningPersonOption[];
  players: PlanningPersonOption[];
} {
  const peopleByMatchId = new Map<string, PlanningPersonOption>();
  for (const person of people) {
    peopleByMatchId.set(person.id, person);
    for (const matchId of person.matchIds) {
      peopleByMatchId.set(matchId, person);
    }
  }

  const coachesById = new Map<string, PlanningPersonOption>();
  const playersById = new Map<string, PlanningPersonOption>();

  for (const team of teams) {
    for (const coachId of team.coachIds) {
      const person = peopleByMatchId.get(coachId);
      if (person) coachesById.set(person.id, person);
    }
    for (const playerId of team.playerIds) {
      const person = peopleByMatchId.get(playerId);
      if (person) playersById.set(person.id, person);
    }
  }

  // Membres hors roster : classés via le rôle club.
  for (const person of people) {
    if (coachesById.has(person.id) || playersById.has(person.id)) continue;
    if (person.role === "coach") coachesById.set(person.id, person);
    if (person.role === "player") playersById.set(person.id, person);
  }

  const byName = (a: PlanningPersonOption, b: PlanningPersonOption) =>
    a.name.localeCompare(b.name, "fr");

  return {
    coaches: [...coachesById.values()].sort(byName),
    players: [...playersById.values()].sort(byName),
  };
}

/** Début de semaine (lundi). */
export function startOfWeek(date: Date): Date {
  const day = dateOnly(date);
  const weekday = day.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  day.setDate(day.getDate() + offset);
  return day;
}

/** Fin de semaine (dimanche). */
export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

/** Grille mois (6 semaines × 7 jours, lundi → dimanche). */
export function buildMonthGrid(monthCursor: Date): Date[] {
  const firstOfMonth = new Date(
    monthCursor.getFullYear(),
    monthCursor.getMonth(),
    1,
  );
  const gridStart = startOfWeek(firstOfMonth);
  const days: Date[] = [];
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    days.push(day);
  }
  return days;
}

/** Jours d'une semaine à partir d'une date. */
export function buildWeekDays(weekCursor: Date): Date[] {
  const start = startOfWeek(weekCursor);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

/** Libellé période calendrier selon la vue. */
export function formatCalendarPeriodLabel(
  cursor: Date,
  view: "month" | "week" | "day",
): string {
  if (view === "month") {
    return new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(cursor);
  }
  if (view === "day") {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(cursor);
  }
  const start = startOfWeek(cursor);
  const end = endOfWeek(cursor);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(end)}`;
  }
  const startLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(end);
  return `${startLabel} – ${endLabel}`;
}

/** Formate l'heure d'un event (fr-FR). */
export function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Formate date + heure courte pour listes. */
export function formatEventWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Formate un en-tête de jour. */
export function formatDayHeading(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
