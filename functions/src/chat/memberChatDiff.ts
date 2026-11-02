import { stringArray, uniq } from "../common";

type MemberData = Record<string, unknown> | undefined;

/**
 * Champs d'une fiche membre qui influencent les chats `staff` / `club` et les
 * conversations privées : rôle, statut, compte lié. Les équipes (`teamIds`)
 * relèvent du trigger d'équipe ; profil, snapshot, RSVP… ne comptent pas.
 */
export function memberChatFieldsChanged(before: MemberData, after: MemberData): boolean {
  // Création ou suppression : toujours.
  if (!before || !after) return true;
  const scalar = ["role", "status", "accountUid", "userId"] as const;
  for (const key of scalar) {
    if (String(before[key] ?? "") !== String(after[key] ?? "")) return true;
  }
  return false;
}

/** Uid Auth d'une fiche (`accountUid`, sinon `userId`) ; `null` sans compte. */
export function memberAuthUid(data: MemberData): string | null {
  const accountUid = String(data?.accountUid ?? "").trim();
  if (accountUid) return accountUid;
  const userId = String(data?.userId ?? "").trim();
  return userId || null;
}

/** Ajouts / retraits d'uid sur une conversation système. */
export type ParticipantDelta = { add: string[]; remove: string[] };

/** Effet d'une écriture de fiche sur la messagerie du club. */
export type MemberChatDelta = {
  /** Chat `club` : licenciés actifs ayant un compte. */
  club: ParticipantDelta;
  /** Chat `staff` : coachs et admins actifs. */
  staff: ParticipantDelta;
  /** Uids qui quittent le club (DM, groupes coachs, canaux à retirer). */
  leftUids: string[];
};

function participantDelta(
  uidBefore: string | null,
  inBefore: boolean,
  uidAfter: string | null,
  inAfter: boolean,
): ParticipantDelta {
  const sameUid = uidBefore === uidAfter;
  return {
    add: inAfter && uidAfter && !(inBefore && sameUid) ? [uidAfter] : [],
    remove: inBefore && uidBefore && !(inAfter && sameUid) ? [uidBefore] : [],
  };
}

/**
 * Calcule, à partir d'une écriture de fiche ([before] → [after]), les uids à
 * ajouter / retirer de `club` et `staff`, et ceux qui quittent le club.
 * Une fiche archivée ou sans compte ne participe à rien.
 */
export function memberChatDelta(before: MemberData, after: MemberData): MemberChatDelta {
  const uidBefore = memberAuthUid(before);
  const uidAfter = memberAuthUid(after);
  const activeBefore = !!before && String(before.status ?? "") !== "archived" && !!uidBefore;
  const activeAfter = !!after && String(after.status ?? "") !== "archived" && !!uidAfter;
  const isStaff = (data: MemberData) =>
    ["admin", "coach"].includes(String(data?.role ?? ""));

  const club = participantDelta(uidBefore, activeBefore, uidAfter, activeAfter);
  return {
    club,
    staff: participantDelta(
      uidBefore,
      activeBefore && isStaff(before),
      uidAfter,
      activeAfter && isStaff(after),
    ),
    leftUids: uniq(club.remove),
  };
}

/** Scope d'audience d'un canal admin ciblé. */
export type ChannelAudienceScopeType = "categories" | "teams" | "parents";

const SCOPE_KEY_PREFIXES: Array<[string, ChannelAudienceScopeType]> = [
  ["category:", "categories"],
  ["custom-teams:", "teams"],
  ["custom-parents:", "parents"],
];

/**
 * Relit le scope d'un canal ciblé depuis sa `systemKey`
 * (`category:a|b`, `custom-teams:…`, `custom-parents:…`) ; `null` sinon.
 */
export function parseChannelScopeSystemKey(
  systemKey: unknown,
): { scopeType: ChannelAudienceScopeType; scopeIds: string[] } | null {
  const key = String(systemKey ?? "");
  for (const [prefix, scopeType] of SCOPE_KEY_PREFIXES) {
    if (!key.startsWith(prefix)) continue;
    const scopeIds = uniq(
      key.slice(prefix.length).split("|").map((id) => id.trim()).filter(Boolean),
    );
    return scopeIds.length > 0 ? { scopeType, scopeIds } : null;
  }
  return null;
}

/** Politique d'écriture d'un DM dont il ne reste qu'un participant. */
export const CHAT_CLOSED_POLICY = "closed";

/** Types de conversation dont les participants ne sont pas recalculés par équipe. */
export const PRIVATE_CONVERSATION_TYPES = new Set(["dm", "coach_group"]);

/**
 * Politique après retrait de [removedUid] : un DM / groupe coachs réduit à
 * un seul participant est fermé (lecture seule).
 */
export function writePolicyAfterRemoval(params: {
  type: unknown;
  participantUids: unknown;
  removedUid: string;
  writePolicy: unknown;
}): string {
  const current = String(params.writePolicy ?? "open");
  if (!PRIVATE_CONVERSATION_TYPES.has(String(params.type ?? ""))) return current;
  const remaining = stringArray(params.participantUids).filter(
    (uid) => uid !== params.removedUid,
  );
  return remaining.length <= 1 ? CHAT_CLOSED_POLICY : current;
}

/** `details.reason` d'un refus `already-exists` de `createCategoryChannel`. */
export const CHANNEL_EXISTS_REASON = "channel_exists";

/** Politiques d'écriture acceptées pour un canal ciblé. */
export const CHANNEL_WRITE_POLICIES = new Set([
  "open",
  "admins_only",
  "coaches_and_admins",
]);

/** Longueur max d'un titre de conversation (aligné firestore.rules). */
export const CONVERSATION_TITLE_MAX = 80;
