import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import {
  Collections,
  Fields,
  MemberRoles,
} from "./constants";
import {
  addAudienceToUpcomingTeamEvents,
  removeAudienceFromUpcomingTeamEvents,
  syncUpcomingEventsAudienceFromTeams,
  type TeamOption,
} from "./eventService";

/** Rôle roster équipe (joueur ou coach). */
export type TeamRosterRole =
  | typeof MemberRoles.player
  | typeof MemberRoles.coach;

function teamsCol(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.teams,
  );
}

function membersCol(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.members,
  );
}

function parseStringIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

function parseTeamIds(raw: unknown): string[] {
  return parseStringIds(raw);
}

/** UID roster aligné Flutter (`accountUid` / `userId` legacy, sinon memberId). */
function rosterIdFromMemberData(
  memberId: string,
  memberData: Record<string, unknown>,
): string {
  const accountUid = String(
    memberData[Fields.accountUid] ?? memberData[Fields.userId] ?? "",
  ).trim();
  return accountUid || memberId;
}

/** IDs possibles pour matcher un membre dans un roster. */
function memberMatchIds(
  memberId: string,
  memberData: Record<string, unknown>,
): Set<string> {
  const ids = new Set<string>([memberId]);
  const accountUid = String(
    memberData[Fields.accountUid] ?? memberData[Fields.userId] ?? "",
  ).trim();
  if (accountUid) ids.add(accountUid);
  return ids;
}

/** Crée une équipe vide (nom + catégorie). */
export async function createTeam(params: {
  clubId: string;
  name: string;
  category: string;
}): Promise<string> {
  const trimmedName = params.name.trim();
  const trimmedCategory = params.category.trim();
  if (!trimmedName) {
    throw new Error("Le nom de l’équipe est requis.");
  }

  const teamRef = doc(teamsCol(params.clubId));
  await runTransaction(getAppFirestore(), async (tx) => {
    tx.set(teamRef, {
      [Fields.name]: trimmedName,
      [Fields.category]: trimmedCategory,
      [Fields.playerIds]: [],
      [Fields.coachIds]: [],
      [Fields.pendingPlayerIds]: [],
      [Fields.createdAt]: serverTimestamp(),
      [Fields.updatedAt]: serverTimestamp(),
    });
  });
  return teamRef.id;
}

/** Met à jour le nom et/ou la catégorie d’une équipe. */
export async function updateTeam(params: {
  clubId: string;
  teamId: string;
  name?: string;
  category?: string;
}): Promise<void> {
  const patch: Record<string, unknown> = {
    [Fields.updatedAt]: serverTimestamp(),
  };
  if (params.name !== undefined) {
    const trimmedName = params.name.trim();
    if (!trimmedName) {
      throw new Error("Le nom de l’équipe est requis.");
    }
    patch[Fields.name] = trimmedName;
  }
  if (params.category !== undefined) {
    patch[Fields.category] = params.category.trim();
  }
  await updateDoc(doc(teamsCol(params.clubId), params.teamId), patch);
}

/**
 * Ajoute un membre au roster (playerIds ou coachIds) et synchronise
 * `members.teamIds`. L’ID roster suit Flutter (`accountUid` si lié).
 */
export async function addMemberToTeam(params: {
  clubId: string;
  memberId: string;
  teamId: string;
  role: TeamRosterRole;
}): Promise<void> {
  const db = getAppFirestore();
  const teamDocument = doc(teamsCol(params.clubId), params.teamId);
  const memberDocument = doc(membersCol(params.clubId), params.memberId);
  let audienceIdToSync: string | null = null;

  await runTransaction(db, async (tx) => {
    const teamSnap = await tx.get(teamDocument);
    const memberSnap = await tx.get(memberDocument);
    if (!teamSnap.exists()) {
      throw new Error("Équipe introuvable.");
    }
    if (!memberSnap.exists()) {
      throw new Error("Membre introuvable.");
    }

    const memberData = memberSnap.data() as Record<string, unknown>;
    const matchIds = memberMatchIds(params.memberId, memberData);
    const rosterId = rosterIdFromMemberData(params.memberId, memberData);

    const teamData = teamSnap.data() as Record<string, unknown>;
    const field =
      params.role === MemberRoles.coach ? Fields.coachIds : Fields.playerIds;
    const currentIds = parseStringIds(teamData[field]);
    const alreadyOnRoster = currentIds.some((id) => matchIds.has(id));

    let nextIds = currentIds;
    if (!alreadyOnRoster) {
      nextIds = [...currentIds, rosterId];
    } else if (
      rosterId !== params.memberId &&
      currentIds.includes(params.memberId) &&
      !currentIds.includes(rosterId)
    ) {
      // Migre un ancien memberId vers accountUid (aligné reconcile Flutter).
      nextIds = currentIds.map((id) =>
        id === params.memberId ? rosterId : id,
      );
    }

    const teamIds = parseTeamIds(memberData[Fields.teamIds]);
    const needsTeamIds = !teamIds.includes(params.teamId);
    const rosterChanged =
      nextIds.length !== currentIds.length ||
      nextIds.some((id, index) => id !== currentIds[index]);

    if (rosterChanged) {
      tx.update(teamDocument, {
        [field]: nextIds,
        [Fields.updatedAt]: serverTimestamp(),
      });
      if (params.role === MemberRoles.player) {
        audienceIdToSync = rosterId;
      }
    }

    if (needsTeamIds) {
      tx.update(memberDocument, {
        [Fields.teamIds]: [...teamIds, params.teamId],
        [Fields.updatedAt]: serverTimestamp(),
      });
    }
  });

  if (audienceIdToSync) {
    await addAudienceToUpcomingTeamEvents({
      clubId: params.clubId,
      teamId: params.teamId,
      audienceId: audienceIdToSync,
    });
  }
}

/**
 * Retire un membre du roster (y compris variantes accountUid) et met à jour
 * `members.teamIds` si plus présent sur aucun roster de l’équipe.
 */
export async function removeMemberFromTeam(params: {
  clubId: string;
  memberId: string;
  teamId: string;
  role: TeamRosterRole;
  accountUid?: string | null;
}): Promise<void> {
  const db = getAppFirestore();
  const teamDocument = doc(teamsCol(params.clubId), params.teamId);
  const memberDocument = doc(membersCol(params.clubId), params.memberId);
  const idsToRemove = new Set(
    [params.memberId, params.accountUid?.trim()].filter(Boolean) as string[],
  );
  let shouldSyncAudience = false;

  await runTransaction(db, async (tx) => {
    const teamSnap = await tx.get(teamDocument);
    const memberSnap = await tx.get(memberDocument);
    if (!teamSnap.exists()) {
      throw new Error("Équipe introuvable.");
    }
    if (!memberSnap.exists()) {
      throw new Error("Membre introuvable.");
    }

    const teamData = teamSnap.data() as Record<string, unknown>;
    const field =
      params.role === MemberRoles.coach ? Fields.coachIds : Fields.playerIds;
    const currentIds = parseStringIds(teamData[field]);
    const nextIds = currentIds.filter((id) => !idsToRemove.has(id));
    const rosterChanged = nextIds.length !== currentIds.length;
    tx.update(teamDocument, {
      [field]: nextIds,
      [Fields.updatedAt]: serverTimestamp(),
    });
    if (rosterChanged && params.role === MemberRoles.player) {
      shouldSyncAudience = true;
    }

    const playerIds = parseStringIds(
      field === Fields.playerIds ? nextIds : teamData[Fields.playerIds],
    );
    const coachIds = parseStringIds(
      field === Fields.coachIds ? nextIds : teamData[Fields.coachIds],
    );
    const stillOnTeam =
      playerIds.some((id) => idsToRemove.has(id)) ||
      coachIds.some((id) => idsToRemove.has(id));

    if (!stillOnTeam) {
      const memberData = memberSnap.data() as Record<string, unknown>;
      const teamIds = parseTeamIds(memberData[Fields.teamIds]).filter(
        (id) => id !== params.teamId,
      );
      tx.update(memberDocument, {
        [Fields.teamIds]: teamIds,
        [Fields.updatedAt]: serverTimestamp(),
      });
    }
  });

  if (shouldSyncAudience) {
    for (const audienceId of idsToRemove) {
      await removeAudienceFromUpcomingTeamEvents({
        clubId: params.clubId,
        teamId: params.teamId,
        audienceId,
      });
    }
  }
}

/**
 * Supprime une équipe et retire son id des `teamIds` des membres concernés.
 */
export async function deleteTeam(params: {
  clubId: string;
  teamId: string;
}): Promise<void> {
  const db = getAppFirestore();
  const teamDocument = doc(teamsCol(params.clubId), params.teamId);
  const teamSnap = await getDoc(teamDocument);
  if (!teamSnap.exists()) {
    throw new Error("Équipe introuvable.");
  }

  const teamData = teamSnap.data() as Record<string, unknown>;
  const rosterIds = new Set([
    ...parseStringIds(teamData[Fields.playerIds]),
    ...parseStringIds(teamData[Fields.coachIds]),
  ]);

  const membersWithTeamSnap = await getDocs(
    query(
      membersCol(params.clubId),
      where(Fields.teamIds, "array-contains", params.teamId),
    ),
  );

  const batch = writeBatch(db);
  const touchedMemberIds = new Set<string>();

  for (const memberSnap of membersWithTeamSnap.docs) {
    touchedMemberIds.add(memberSnap.id);
    const memberData = memberSnap.data() as Record<string, unknown>;
    const nextTeamIds = parseTeamIds(memberData[Fields.teamIds]).filter(
      (id) => id !== params.teamId,
    );
    batch.update(memberSnap.ref, {
      [Fields.teamIds]: nextTeamIds,
      [Fields.updatedAt]: serverTimestamp(),
    });
  }

  for (const rosterId of rosterIds) {
    if (touchedMemberIds.has(rosterId)) continue;
    const memberRef = doc(membersCol(params.clubId), rosterId);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) continue;
    const memberData = memberSnap.data() as Record<string, unknown>;
    const teamIds = parseTeamIds(memberData[Fields.teamIds]);
    if (!teamIds.includes(params.teamId)) continue;
    batch.update(memberRef, {
      [Fields.teamIds]: teamIds.filter((id) => id !== params.teamId),
      [Fields.updatedAt]: serverTimestamp(),
    });
  }

  batch.delete(teamDocument);
  await batch.commit();
}

/**
 * Recalcule `members.teamIds` à partir des rosters et normalise les IDs
 * roster (`memberId` → `accountUid` quand le compte est lié).
 * @returns true si au moins un document a été mis à jour.
 */
export async function reconcileMemberTeamIds(
  clubId: string,
  preloaded?: {
    members: { memberId: string; accountUid: string | null; teamIds: string[] }[];
    teams: TeamOption[];
  },
): Promise<boolean> {
  const db = getAppFirestore();

  let members: {
    memberId: string;
    accountUid: string | null;
    teamIds: string[];
  }[];
  let teams: TeamOption[];

  if (preloaded) {
    members = preloaded.members.map((member) => ({ ...member }));
    teams = preloaded.teams.map((team) => ({
      ...team,
      playerIds: [...team.playerIds],
      coachIds: [...team.coachIds],
    }));
  } else {
    const [teamsSnap, membersSnap] = await Promise.all([
      getDocs(teamsCol(clubId)),
      getDocs(membersCol(clubId)),
    ]);
    teams = teamsSnap.docs.map((teamDoc) => {
      const data = teamDoc.data() as Record<string, unknown>;
      return {
        id: teamDoc.id,
        name: String(data[Fields.name] ?? ""),
        category: String(data[Fields.category] ?? ""),
        playerIds: parseStringIds(data[Fields.playerIds]),
        coachIds: parseStringIds(data[Fields.coachIds]),
      };
    });
    members = membersSnap.docs.map((memberDoc) => {
      const data = memberDoc.data() as Record<string, unknown>;
      const accountUid = String(
        data[Fields.accountUid] ?? data[Fields.userId] ?? "",
      ).trim();
      return {
        memberId: memberDoc.id,
        accountUid: accountUid || null,
        teamIds: parseTeamIds(data[Fields.teamIds]),
      };
    });
  }

  const preferredRosterId = new Map<string, string>();
  for (const member of members) {
    if (member.accountUid && member.accountUid !== member.memberId) {
      preferredRosterId.set(member.memberId, member.accountUid);
    }
  }

  function normalizeRosterIds(ids: string[]): string[] {
    const next: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      const preferred = preferredRosterId.get(id) ?? id;
      if (seen.has(preferred)) continue;
      seen.add(preferred);
      next.push(preferred);
    }
    return next;
  }

  function sameIds(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((id, index) => id === b[index]);
  }

  const batch = writeBatch(db);
  let writes = 0;

  for (const team of teams) {
    const nextPlayerIds = normalizeRosterIds(team.playerIds);
    const nextCoachIds = normalizeRosterIds(team.coachIds);
    const playersChanged = !sameIds(nextPlayerIds, team.playerIds);
    const coachesChanged = !sameIds(nextCoachIds, team.coachIds);
    if (!playersChanged && !coachesChanged) continue;

    team.playerIds = nextPlayerIds;
    team.coachIds = nextCoachIds;
    batch.update(doc(teamsCol(clubId), team.id), {
      [Fields.playerIds]: nextPlayerIds,
      [Fields.coachIds]: nextCoachIds,
      [Fields.updatedAt]: serverTimestamp(),
    });
    writes += 1;
  }

  const teamIdsByMatchId = new Map<string, Set<string>>();
  for (const team of teams) {
    for (const rosterId of [...team.playerIds, ...team.coachIds]) {
      const set = teamIdsByMatchId.get(rosterId) ?? new Set<string>();
      set.add(team.id);
      teamIdsByMatchId.set(rosterId, set);
    }
  }

  for (const member of members) {
    const matchIds = new Set(
      [member.memberId, member.accountUid].filter(Boolean) as string[],
    );
    const expected = new Set<string>();
    for (const matchId of matchIds) {
      const fromRoster = teamIdsByMatchId.get(matchId);
      if (!fromRoster) continue;
      for (const teamId of fromRoster) expected.add(teamId);
    }

    const currentSet = new Set(member.teamIds);
    const same =
      expected.size === currentSet.size &&
      [...expected].every((teamId) => currentSet.has(teamId));
    if (same) continue;

    const nextTeamIds = [...expected].sort((a, b) => a.localeCompare(b));
    batch.update(doc(membersCol(clubId), member.memberId), {
      [Fields.teamIds]: nextTeamIds,
      [Fields.updatedAt]: serverTimestamp(),
    });
    writes += 1;
  }

  if (writes > 0) {
    await batch.commit();
  }

  // Répare les convocations manquantes sur les events à venir (ex. ajouts portail
  // avant la sync audience).
  await syncUpcomingEventsAudienceFromTeams(clubId, teams);

  return writes > 0;
}

/** Alias pour l’import CSV / API historique — préférer `addMemberToTeam`. */
export { addMemberToTeam as assignMemberToTeam };
/** Groupe les équipes par catégorie (libellé FR pour le vide). */
export function groupTeamsByCategory(
  teams: TeamOption[],
): { category: string; teams: TeamOption[] }[] {
  const byCategory = new Map<string, TeamOption[]>();
  for (const team of teams) {
    const category = team.category.trim() || "Sans catégorie";
    const list = byCategory.get(category) ?? [];
    list.push(team);
    byCategory.set(category, list);
  }
  return [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([category, categoryTeams]) => ({
      category,
      teams: [...categoryTeams].sort((a, b) =>
        a.name.localeCompare(b.name, "fr"),
      ),
    }));
}
