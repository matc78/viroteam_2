import { Timestamp } from "firebase/firestore";
import type { ClubRecord } from "./clubService";
import {
  Fields,
  GuardianRelations,
  GuardianStatuses,
} from "./constants";
import {
  primaryBadge,
  type ClubAccess,
  type DisplayBadge,
} from "@/lib/auth/permissions";
import {
  parseNotificationPreferences,
  type NotificationPreferences,
} from "./notificationPreferences";

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
  avatarUrl: string | null;
  /**
   * Index `users/{uid}.memberClubIds` : clubs où le compte a une fiche.
   * Aucun droit n’y figure (ils vivent sur `members/{uid}.permissions`) ;
   * écrit par les Cloud Functions uniquement.
   */
  memberClubIds: string[];
  parentLinks: ParentLink[];
  parentClubIds: string[];
  /** Équipes des enfants (index maintenu serveur). */
  parentTeamIds: string[];
  notificationPreferences: NotificationPreferences;
  profileCompleted: boolean;
  disabled: boolean;
  /** Accès anticipé messagerie (`flags.chatMessaging`), posé en console. */
  chatMessaging: boolean;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
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
  const legal =
    (data?.[Fields.legal] as Record<string, unknown> | undefined) ?? {};
  const rawMemberClubIds =
    (data?.[Fields.memberClubIds] as unknown[] | undefined) ?? [];
  const rawParentLinks =
    (data?.[Fields.parentLinks] as Array<Record<string, unknown>> | undefined) ??
    [];
  const rawParentClubIds = (data?.[Fields.parentClubIds] as unknown[] | undefined) ?? [];
  const rawParentTeamIds = (data?.[Fields.parentTeamIds] as unknown[] | undefined) ?? [];

  const rawAvatar = data?.[Fields.avatarUrl];
  const termsAcceptedRaw = legal[Fields.termsAcceptedAt];
  const termsVersionRaw = legal[Fields.termsVersion];
  return {
    uid: (data?.[Fields.uid] as string | undefined) ?? uid,
    email: (data?.[Fields.email] as string | undefined) ?? "",
    emailNorm: (data?.[Fields.emailNorm] as string | undefined) ?? "",
    firstName: (data?.[Fields.firstName] as string | undefined) ?? "",
    lastName: (data?.[Fields.lastName] as string | undefined) ?? "",
    displayName: (data?.[Fields.displayName] as string | undefined) ?? "",
    avatarUrl:
      typeof rawAvatar === "string" && rawAvatar.trim()
        ? rawAvatar.trim()
        : null,
    memberClubIds: [
      ...new Set(
        rawMemberClubIds.map((item) => String(item ?? "").trim()).filter(Boolean),
      ),
    ],
    parentLinks: rawParentLinks
      .map(parseParentLink)
      .filter((link): link is ParentLink => link !== null),
    parentClubIds: rawParentClubIds
      .map((item) => String(item ?? "").trim())
      .filter(Boolean),
    parentTeamIds: rawParentTeamIds
      .map((item) => String(item ?? "").trim())
      .filter(Boolean),
    notificationPreferences: parseNotificationPreferences(
      data?.[Fields.notificationPreferences],
    ),
    profileCompleted: Boolean(flags[Fields.profileCompleted]),
    disabled: Boolean(flags[Fields.disabled]),
    chatMessaging: flags[Fields.chatMessaging] === true,
    termsAcceptedAt:
      termsAcceptedRaw instanceof Timestamp
        ? termsAcceptedRaw.toDate()
        : null,
    termsVersion:
      typeof termsVersionRaw === "string" && termsVersionRaw.trim()
        ? termsVersionRaw.trim()
        : null,
  };
}

/** Clubs où le compte a une fiche membre (accès à l’espace Bureau). */
export function bureauClubIds(profile: ViroUserProfile | null): string[] {
  if (!profile) return [];
  return [...profile.memberClubIds];
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

/**
 * Club enrichi du badge du compte (`admin` | `coach` | `player` |
 * `member` | `parent`), ou `null` (droits pas encore chargés).
 */
export type ClubWithBadge = ClubRecord & { badge: DisplayBadge | null };

/**
 * Badge du compte dans un club : badge principal de sa fiche ; `parent` si
 * la fiche n'a ni droit admin ni équipe (`member`) mais un lien parent actif,
 * ou s'il n'a pas de fiche. `null` : droits pas encore chargés.
 */
export function accountClubBadge(
  access: ClubAccess | undefined,
  isParentInClub: boolean,
): DisplayBadge | null {
  if (!access) return isParentInClub ? "parent" : null;
  const badge = primaryBadge(access);
  if (badge === "member" && isParentInClub) return "parent";
  return badge;
}

/** Espace portail (bureau vs famille / parent). */
export type PortalSpace = "bureau" | "family";

/** Pastille sélecteur : un couple (club, espace) — Parent = lien parent, pas membership. */
export type ClubMembershipTile = ClubWithBadge & {
  space: PortalSpace;
};

/**
 * Pastilles unifiées : clubs bureau (badge de la fiche du club) puis clubs
 * parent. Un même club peut apparaître deux fois si double contexte.
 */
export function buildClubMembershipTiles(
  bureauClubs: ClubRecord[],
  familyClubs: ClubRecord[],
  accessByClub: Record<string, ClubAccess>,
): ClubMembershipTile[] {
  const familyClubIds = new Set(familyClubs.map((club) => club.id));
  const bureauTiles: ClubMembershipTile[] = bureauClubs.map((club) => {
    const access = accessByClub[club.id];
    return {
      ...club,
      badge: access
        ? accountClubBadge(access, familyClubIds.has(club.id))
        : null,
      space: "bureau",
    };
  });
  const familyTiles: ClubMembershipTile[] = familyClubs.map((club) => ({
    ...club,
    badge: "parent",
    space: "family",
  }));
  return [...bureauTiles, ...familyTiles];
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
