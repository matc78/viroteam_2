import { Timestamp } from "firebase/firestore";
import { Fields, MemberRoles } from "./constants";

/** Résumé d’adhésion club sur users/{uid}.clubMemberships. */
export type ClubMembership = {
  clubId: string;
  role: string;
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
  profileCompleted: boolean;
  disabled: boolean;
};

/** Parse un document users/{uid}. */
export function parseUserProfile(
  uid: string,
  data: Record<string, unknown> | undefined,
): ViroUserProfile {
  const flags = (data?.[Fields.flags] as Record<string, unknown> | undefined) ?? {};
  const rawMemberships =
    (data?.[Fields.clubMemberships] as Array<Record<string, unknown>> | undefined) ??
    [];

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
    profileCompleted: Boolean(flags[Fields.profileCompleted]),
    disabled: Boolean(flags[Fields.disabled]),
  };
}

/** Clubs où l’utilisateur est admin. */
export function adminClubIds(profile: ViroUserProfile | null): string[] {
  if (!profile) return [];
  return profile.clubMemberships
    .filter((membership) => membership.role === MemberRoles.admin)
    .map((membership) => membership.clubId);
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
