import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { stringArray, uniq } from "../common";
import { normalizeRsvpStatus, type RsvpStatus, type RsvpTally } from "./copy";
import { memberAccountUid } from "./recipients";

const GUARDIAN_STATUS_ACTIVE = "active";

/**
 * Lectures d'un club mises en cache le temps d'une exécution (cron, trigger) :
 * un même membre / équipe convoqué sur plusieurs events n'est lu qu'une fois.
 */
export class ClubDirectory {
  private readonly teams = new Map<string, Promise<DocumentData | null>>();
  private readonly members = new Map<string, Promise<DocumentData | null>>();
  private readonly memberIds = new Map<string, Promise<string | null>>();
  private readonly guardians = new Map<string, Promise<string[]>>();
  private club: Promise<DocumentData | null> | null = null;

  constructor(
    private readonly firestore: Firestore,
    readonly clubId: string,
  ) {}

  private clubRef() {
    return this.firestore.collection("clubs").doc(this.clubId);
  }

  /** Document club (`null` si absent). */
  clubData(): Promise<DocumentData | null> {
    this.club ??= this.clubRef()
      .get()
      .then((snap) => (snap.exists ? snap.data()! : null));
    return this.club;
  }

  /** Nom du club (vide si inconnu). */
  async clubName(): Promise<string> {
    return String((await this.clubData())?.name ?? "").trim();
  }

  /** Document équipe (`null` si absent). */
  team(teamId: string): Promise<DocumentData | null> {
    return cached(this.teams, teamId, () =>
      this.clubRef()
        .collection("teams")
        .doc(teamId)
        .get()
        .then((snap) => (snap.exists ? snap.data()! : null)),
    );
  }

  /** Fiche membre (`null` si absente). */
  member(memberId: string): Promise<DocumentData | null> {
    return cached(this.members, memberId, () =>
      this.clubRef()
        .collection("members")
        .doc(memberId)
        .get()
        .then((snap) => (snap.exists ? snap.data()! : null)),
    );
  }

  /**
   * memberId d'un identifiant d'audience (memberId direct ou uid de compte via
   * `member_accounts`), `null` si inconnu.
   */
  resolveMemberId(rosterId: string): Promise<string | null> {
    return cached(this.memberIds, rosterId, async () => {
      if (await this.member(rosterId)) return rosterId;
      const account = await this.clubRef()
        .collection("member_accounts")
        .doc(rosterId)
        .get();
      if (!account.exists) return null;
      const memberId = String(account.data()?.memberId ?? "").trim();
      return memberId || null;
    });
  }

  /** Guardians actifs d'une fiche membre. */
  activeGuardianUids(memberId: string): Promise<string[]> {
    return cached(this.guardians, memberId, async () => {
      const snap = await this.clubRef()
        .collection("members")
        .doc(memberId)
        .collection("guardians")
        .where("status", "==", GUARDIAN_STATUS_ACTIVE)
        .get();
      return snap.docs
        .map((doc) => String(doc.data().parentUid ?? doc.id).trim())
        .filter((uid) => uid.length > 0);
    });
  }

  /**
   * Uid de compte d'un coach : `coachIds` contient un uid ou un memberId selon
   * l'ancienneté de l'équipe.
   */
  async coachAccountUid(coachId: string): Promise<string> {
    const member = await this.member(coachId);
    return member ? (memberAccountUid(member, coachId) ?? coachId) : coachId;
  }
}

function cached<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  let value = cache.get(key);
  if (!value) {
    value = load();
    cache.set(key, value);
  }
  return value;
}

/** Une personne à notifier pour un event, et à quel titre. */
export type EventAudienceEntry = {
  uid: string;
  /**
   * `self` : le joueur convoqué ; `guardian` : un parent de ce joueur ;
   * `coach` : un coach d'équipe non convoqué lui-même.
   */
  relation: "self" | "guardian" | "coach";
  /** Fiche membre concernée (absente pour un coach). */
  memberId?: string;
  /** Prénom de l'enfant (parent uniquement). */
  childFirstName?: string;
  /** Réponse du joueur concerné (`none` pour un coach). */
  rsvp: RsvpStatus;
};

/**
 * Audience détaillée d'un event : convoqués (`teamMemberIds`), leurs parents
 * actifs et les coachs des `teamIds`. Un coach déjà convoqué n'apparaît
 * qu'une fois, comme joueur.
 */
export async function resolveEventAudience(
  directory: ClubDirectory,
  eventData: DocumentData,
): Promise<EventAudienceEntry[]> {
  const rsvp = rsvpMap(eventData.rsvp);
  const entries: EventAudienceEntry[] = [];
  const seenMembers = new Set<string>();
  const selfUids = new Set<string>();

  for (const rosterId of uniq(stringArray(eventData.teamMemberIds))) {
    const memberId = (await directory.resolveMemberId(rosterId)) ?? rosterId;
    // `teamMemberIds` peut contenir les deux alias d'une même personne.
    if (seenMembers.has(memberId)) continue;
    seenMembers.add(memberId);

    const member = await directory.member(memberId);
    const accountUid = member
      ? (memberAccountUid(member, memberId) ?? memberId)
      : rosterId;
    const status = normalizeRsvpStatus(
      rsvp[rosterId] ?? rsvp[memberId] ?? rsvp[accountUid],
    );

    entries.push({ uid: accountUid, relation: "self", memberId, rsvp: status });
    selfUids.add(accountUid);

    const childFirstName =
      String(member?.firstName ?? "").trim() ||
      String(member?.displayName ?? "").trim().split(/\s+/)[0] ||
      undefined;
    for (const guardianUid of await directory.activeGuardianUids(memberId)) {
      entries.push({
        uid: guardianUid,
        relation: "guardian",
        memberId,
        childFirstName,
        rsvp: status,
      });
    }
  }

  for (const uid of await eventCoachUids(directory, eventData)) {
    if (selfUids.has(uid)) continue;
    entries.push({ uid, relation: "coach", rsvp: "none" });
  }

  return entries;
}

/** Uids de compte des coachs des équipes de l'event. */
export async function eventCoachUids(
  directory: ClubDirectory,
  eventData: DocumentData,
): Promise<string[]> {
  const coachUids = new Set<string>();
  for (const teamId of uniq(stringArray(eventData.teamIds))) {
    const team = await directory.team(teamId);
    for (const coachId of stringArray(team?.coachIds)) {
      coachUids.add(await directory.coachAccountUid(coachId));
    }
  }
  return [...coachUids];
}

/**
 * Staff à prévenir des réponses : les coachs de l'event, ou les admins du
 * club si aucune équipe n'a de coach (event « tout le club »).
 */
export async function eventStaffUids(
  directory: ClubDirectory,
  eventData: DocumentData,
): Promise<string[]> {
  const coaches = await eventCoachUids(directory, eventData);
  if (coaches.length > 0) return coaches;
  return uniq(stringArray((await directory.clubData())?.adminIds));
}

/** Décompte des réponses des convoqués (une voix par joueur). */
export function tallyRsvp(entries: EventAudienceEntry[]): RsvpTally {
  const tally: RsvpTally = { yes: 0, no: 0, maybe: 0, none: 0 };
  for (const entry of entries) {
    if (entry.relation !== "self") continue;
    tally[entry.rsvp] += 1;
  }
  return tally;
}

function rsvpMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const id = key.trim();
    if (id) out[id] = String(raw ?? "").trim();
  }
  return out;
}
