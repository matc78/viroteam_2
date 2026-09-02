import { HttpsError } from "firebase-functions/v2/https";
import { uniq } from "./common";

/**
 * Fonctions pures de `setMemberRole` / `removeMember` (testables sans
 * Firestore).
 */

export const ROLE_ADMIN = "admin";
export const ROLE_COACH = "coach";
export const ROLE_PLAYER = "player";
export const MEMBER_ROLES = [ROLE_PLAYER, ROLE_COACH, ROLE_ADMIN] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

function requireId(payload: Record<string, unknown>, name: string): string {
  const value = payload[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError("invalid-argument", `${name} requis`);
  }
  return value.trim();
}

/** Valide `{ clubId, memberId, role }`. */
export function parseSetMemberRoleArgs(data: unknown): {
  clubId: string;
  memberId: string;
  role: MemberRole;
} {
  const payload = (data ?? {}) as Record<string, unknown>;
  const clubId = requireId(payload, "clubId");
  const memberId = requireId(payload, "memberId");
  const rawRole = typeof payload.role === "string" ? payload.role.trim() : "";
  const role = MEMBER_ROLES.find((candidate) => candidate === rawRole);
  if (!role) {
    throw new HttpsError(
      "invalid-argument",
      "role doit être player, coach ou admin",
    );
  }
  return { clubId, memberId, role };
}

/** Valide `{ clubId, memberId }`. */
export function parseRemoveMemberArgs(data: unknown): {
  clubId: string;
  memberId: string;
} {
  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    clubId: requireId(payload, "clubId"),
    memberId: requireId(payload, "memberId"),
  };
}

export type AdminMemberRef = {
  memberId: string;
  accountUid: string | null;
};

/**
 * Identités admin restantes si `target` perd son rôle admin (ou est retiré).
 *
 * Une identité admin = un uid de `club.adminIds` OU une fiche `role == admin`
 * (représentée par son `accountUid`, sinon son `memberId`). On retire toutes
 * les identités de la cible (memberId + accountUid) et on regarde ce qu'il
 * reste : vide ⇒ la cible est le dernier admin.
 */
export function remainingAdminIdentities(params: {
  adminIds: string[];
  adminMembers: AdminMemberRef[];
  target: AdminMemberRef;
}): string[] {
  const targetIds = new Set<string>([params.target.memberId]);
  if (params.target.accountUid) targetIds.add(params.target.accountUid);

  const identities = [
    ...params.adminIds,
    ...params.adminMembers.map((member) => member.accountUid ?? member.memberId),
  ].filter((id) => id.length > 0 && !targetIds.has(id));
  return uniq(identities);
}

/** Vrai si retirer/rétrograder `target` laisserait le club sans admin. */
export function isLastAdmin(params: {
  adminIds: string[];
  adminMembers: AdminMemberRef[];
  target: AdminMemberRef;
}): boolean {
  return remainingAdminIdentities(params).length === 0;
}

/**
 * Nouveau `club.adminIds` après changement de rôle : ajoute `accountUid`
 * si le membre devient admin, le retire s'il cesse de l'être.
 * Sans `accountUid` (fiche non liée), la liste est inchangée.
 */
export function nextAdminIds(params: {
  adminIds: string[];
  accountUid: string | null;
  oldRole: string;
  newRole: MemberRole;
}): string[] {
  const { adminIds, accountUid, oldRole, newRole } = params;
  if (!accountUid) return uniq(adminIds);
  if (newRole === ROLE_ADMIN) {
    return uniq([...adminIds, accountUid]);
  }
  if (oldRole === ROLE_ADMIN) {
    return uniq(adminIds.filter((id) => id !== accountUid));
  }
  return uniq(adminIds);
}

/** `club.adminIds` sans les identités d'un membre retiré. */
export function adminIdsWithout(
  adminIds: string[],
  target: AdminMemberRef,
): string[] {
  return uniq(
    adminIds.filter(
      (id) => id !== target.memberId && id !== target.accountUid,
    ),
  );
}

type Membership = Record<string, unknown>;

function parseMemberships(raw: unknown): Membership[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is Membership => Boolean(item) && typeof item === "object",
    )
    .map((item) => ({ ...item }));
}

/**
 * `users/{uid}.clubMemberships` avec le rôle mis à jour pour `clubId`
 * (entrée ajoutée si absente, autres champs de l'entrée conservés).
 */
export function withMembershipRole(
  raw: unknown,
  clubId: string,
  role: MemberRole,
): Membership[] {
  const memberships = parseMemberships(raw);
  let found = false;
  const next = memberships.map((item) => {
    if (String(item.clubId ?? "") !== clubId) return item;
    found = true;
    return { ...item, role };
  });
  if (!found) next.push({ clubId, role });
  return next;
}

/** `users/{uid}.clubMemberships` sans l'entrée de `clubId`. */
export function withoutMembership(raw: unknown, clubId: string): Membership[] {
  return parseMemberships(raw).filter(
    (item) => String(item.clubId ?? "") !== clubId,
  );
}

/** Décrémente un compteur sans passer sous zéro. */
export function decrementCount(raw: unknown): number {
  const current = Number(raw ?? 0);
  if (!Number.isFinite(current) || current <= 0) return 0;
  return current - 1;
}
