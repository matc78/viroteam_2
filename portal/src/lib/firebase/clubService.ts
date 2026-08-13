import { doc, getDoc, Timestamp, updateDoc } from "firebase/firestore";
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
  createdAt: Date | null;
};

/** Parse un document clubs/{clubId}. */
export function parseClub(
  id: string,
  data: Record<string, unknown>,
): ClubRecord {
  const adminIdsRaw = data[Fields.adminIds];
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
    createdAt: toDate(data[Fields.createdAt]),
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
