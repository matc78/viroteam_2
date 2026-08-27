import { doc, getDoc, Timestamp, updateDoc } from "firebase/firestore";
import {
  coachPermissionsToFirestore,
  parseCoachPermissions,
  type CoachPermissions,
} from "@/lib/auth/coachPermissions";
import { getAppFirestore } from "./app";
import { Collections, Fields } from "./constants";
import { toDate } from "./types";

/** Club Firestore (champs utiles au portail). */
export type ClubRecord = {
  id: string;
  name: string;
  sport: string;
  memberCount: number;
  adminIds: string[];
  helloAssoOrganizationSlug: string;
  onlinePaymentEnabled: boolean;
  /** Fin de saison sportive (planning / récurrence), si configurée. */
  seasonEndDate: Date | null;
  /** URL du logo club (Storage), si présent. */
  logoUrl: string | null;
  createdAt: Date | null;
  /** Droits coach du club (defaults si absents). */
  coachPermissions: CoachPermissions;
};

/** Parse un document clubs/{clubId}. */
export function parseClub(
  id: string,
  data: Record<string, unknown>,
): ClubRecord {
  const adminIdsRaw = data[Fields.adminIds];
  const rawLogo = data[Fields.logoUrl];
  return {
    id,
    name: String(data[Fields.name] ?? ""),
    sport: String(data[Fields.sport] ?? ""),
    memberCount: Number(data[Fields.memberCount] ?? 0),
    adminIds: Array.isArray(adminIdsRaw)
      ? adminIdsRaw.map((idValue) => String(idValue))
      : [],
    helloAssoOrganizationSlug: String(
      data[Fields.helloAssoOrganizationSlug] ?? "",
    ),
    onlinePaymentEnabled: Boolean(data[Fields.onlinePaymentEnabled]),
    seasonEndDate: toDate(data[Fields.seasonEndDate]),
    logoUrl:
      typeof rawLogo === "string" && rawLogo.trim() ? rawLogo.trim() : null,
    createdAt: toDate(data[Fields.createdAt]),
    coachPermissions: parseCoachPermissions(data[Fields.coachPermissions]),
  };
}

/** Charge un club par id. */
export async function getClub(clubId: string): Promise<ClubRecord | null> {
  const snap = await getDoc(doc(getAppFirestore(), Collections.clubs, clubId));
  if (!snap.exists()) return null;
  return parseClub(clubId, snap.data() as Record<string, unknown>);
}

/** Charge plusieurs clubs (ignore les absents). */
export async function getClubsByIds(clubIds: string[]): Promise<ClubRecord[]> {
  const uniqueIds = [...new Set(clubIds.filter(Boolean))];
  const results = await Promise.all(uniqueIds.map((id) => getClub(id)));
  return results.filter((club): club is ClubRecord => club !== null);
}

/** Met à jour la config paiement en ligne HelloAsso du club. */
export async function updateOnlinePaymentConfig(params: {
  clubId: string;
  enabled: boolean;
  organizationSlug?: string | null;
}): Promise<void> {
  const slug = params.organizationSlug?.trim() ?? "";
  await updateDoc(doc(getAppFirestore(), Collections.clubs, params.clubId), {
    [Fields.onlinePaymentEnabled]: params.enabled,
    [Fields.helloAssoOrganizationSlug]: slug,
  });
}

/** Met à jour la fin de saison sportive du club (récurrence planning). */
export async function updateClubSeasonEndDate(params: {
  clubId: string;
  seasonEndDate: Date;
}): Promise<void> {
  const day = params.seasonEndDate;
  await updateDoc(doc(getAppFirestore(), Collections.clubs, params.clubId), {
    [Fields.seasonEndDate]: Timestamp.fromDate(
      new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())),
    ),
    [Fields.updatedAt]: Timestamp.now(),
  });
}

/** Met à jour l’URL du logo club. */
export async function updateClubLogoUrl(params: {
  clubId: string;
  logoUrl: string;
}): Promise<void> {
  await updateDoc(doc(getAppFirestore(), Collections.clubs, params.clubId), {
    [Fields.logoUrl]: params.logoUrl,
    [Fields.updatedAt]: Timestamp.now(),
  });
}

/** Met à jour la matrice des droits coach du club. */
export async function updateClubCoachPermissions(params: {
  clubId: string;
  permissions: CoachPermissions;
}): Promise<void> {
  await updateDoc(doc(getAppFirestore(), Collections.clubs, params.clubId), {
    [Fields.coachPermissions]: coachPermissionsToFirestore(params.permissions),
    [Fields.updatedAt]: Timestamp.now(),
  });
}
