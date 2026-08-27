import { Timestamp } from "firebase/firestore";
import {
  Fields,
  GuardianRelations,
  GuardianStatuses,
  MemberRoles,
} from "./constants";

/** Résumé d’adhésion club sur users/{uid}.clubMemberships. */
export type ClubMembership = {
  clubId: string;
  role: string;
};

/** Lien parent → fiche enfant (index session, pas un rôle club). */
export type ParentLink = {
  clubId: string;
  memberId: string;
  relation: string;
  status: string;
};

/** Profil utilisateur Firestore. */
export type ViroUserProfile = {
  uid: string;
  email: string;
  emailNorm: string;
  firstName: string;
  lastName: string;
  displayName: string;
  clubMemberships: ClubMembership[];
  parentLinks: ParentLink[];
  parentClubIds: string[];
  profileCompleted: boolean;
  disabled: boolean;
};

function parseParentLink(item: Record<string, unknown>): ParentLink | null {
  const clubId = String(item[Fields.clubId] ?? "").trim();
  const memberId = String(item[Fields.memberId] ?? "").trim();
  if (!clubId || !memberId) return null;
  return {
    clubId,
    memberId,
    relation: String(item[Fields.relation] ?? GuardianRelations.parent),
    status: String(item[Fields.status] ?? GuardianStatuses.pending),
  };
}

/** Parse un document users/{uid}. */
export function parseUserProfile(
  uid: string,
  data: Record<string, unknown> | undefined,
): ViroUserProfile {
  const flags = (data?.[Fields.flags] as Record<string, unknown> | undefined) ?? {};
  const rawMemberships =
    (data?.[Fields.clubMemberships] as Array<Record<string, unknown>> | undefined) ??
    [];
  const rawParentLinks =
    (data?.[Fields.parentLinks] as Array<Record<string, unknown>> | undefined) ??
    [];
  const rawParentClubIds = (data?.[Fields.parentClubIds] as unknown[] | undefined) ?? [];

  return {
    uid: (data?.[Fields.uid] as string | undefined) ?? uid,
    email: (data?.[Fields.email] as string | undefined) ?? "",
    emailNorm: (data?.[Fields.emailNorm] as string | undefined) ?? "",
    firstName: (data?.[Fields.firstName] as string | undefined) ?? "",
    lastName: (data?.[Fields.lastName] as string | undefined) ?? "",
    displayName: (data?.[Fields.displayName] as string | undefined) ?? "",
    clubMemberships: rawMemberships
      .map((item) => ({
        clubId: String(item[Fields.clubId] ?? ""),
        role: String(item[Fields.role] ?? ""),
      }))
      .filter((membership) => membership.clubId.length > 0),
    parentLinks: rawParentLinks
      .map(parseParentLink)
      .filter((link): link is ParentLink => link !== null),
    parentClubIds: rawParentClubIds
      .map((item) => String(item ?? "").trim())
      .filter(Boolean),
    profileCompleted: Boolean(flags[Fields.profileCompleted]),
    disabled: Boolean(flags[Fields.disabled]),
  };
}

/** Rôles avec accès à l’espace Bureau du portail. */
const BUREAU_ROLES = new Set<string>([
  MemberRoles.admin,
  MemberRoles.coach,
  MemberRoles.player,
]);

/** Clubs où l’utilisateur est admin. */
export function adminClubIds(profile: ViroUserProfile | null): string[] {
  if (!profile) return [];
  return profile.clubMemberships
    .filter((membership) => membership.role === MemberRoles.admin)
    .map((membership) => membership.clubId);
}

/** Clubs où l’utilisateur a un rôle bureau (admin, coach ou joueur). */
export function bureauClubIds(profile: ViroUserProfile | null): string[] {
  if (!profile) return [];
  const ids = new Set<string>();
  for (const membership of profile.clubMemberships) {
    if (BUREAU_ROLES.has(membership.role) && membership.clubId) {
      ids.add(membership.clubId);
    }
  }
  return [...ids];
}

/**
 * Rôle club pour un club donné.
 * En cas de multi-adhésions, privilégie admin > coach > player.
 */
export function membershipRoleForClub(
  profile: ViroUserProfile | null,
  clubId: string | null | undefined,
): string | null {
  if (!profile || !clubId) return null;
  const roles = profile.clubMemberships
    .filter((membership) => membership.clubId === clubId)
    .map((membership) => membership.role);
  if (roles.includes(MemberRoles.admin)) return MemberRoles.admin;
  if (roles.includes(MemberRoles.coach)) return MemberRoles.coach;
  if (roles.includes(MemberRoles.player)) return MemberRoles.player;
  return roles[0] ?? null;
}

/** Liens parent actifs (espace famille). */
export function activeParentLinks(profile: ViroUserProfile | null): ParentLink[] {
  if (!profile) return [];
  return profile.parentLinks.filter(
    (link) => link.status === GuardianStatuses.active,
  );
}

/** Clubs où l’utilisateur a au moins un enfant lié (lien active). */
export function familyClubIds(profile: ViroUserProfile | null): string[] {
  const ids = new Set(activeParentLinks(profile).map((link) => link.clubId));
  return [...ids];
}

/** Sépare prénom / nom depuis un displayName libre. */
export function splitDisplayName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = displayName.trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/** Convertit Timestamp | Date | string en Date. */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const withToDate = value as { toDate: () => Date };
    try {
      return withToDate.toDate();
    } catch {
      return null;
    }
  }
  return null;
}
