import { doc, getDoc, Timestamp, updateDoc } from "firebase/firestore";
import {
  coachPermissionsToFirestore,
  parseCoachPermissions,
  type CoachPermissions,
} from "@/lib/auth/coachPermissions";
import type { PracticeLocation } from "@/lib/clubSetup/clubSetupDraft";
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
  /** Compte Stripe Connect Express du club. */
  stripeConnectedAccountId: string;
  /** Statut onboarding Stripe Connect. */
  stripeConnectStatus: StripeConnectStatus;
  /** Fin de saison sportive (planning / récurrence), si configurée. */
  seasonEndDate: Date | null;
  /** URL du logo club (Storage), si présent. */
  logoUrl: string | null;
  /** Couleur de marque (`#RRGGBB` ou `#PRIMARY+#SECONDARY`). */
  brandColorHex: string | null;
  createdAt: Date | null;
  /** Droits coach du club (defaults si absents). */
  coachPermissions: CoachPermissions;
  /** Lieux de pratique (création d’événement, setup club). */
  practiceLocations: PracticeLocation[];
};

/** Parse le tableau `practiceLocations` d’un document club. */
function parsePracticeLocations(raw: unknown): PracticeLocation[] {
  if (!Array.isArray(raw)) return [];
  const locations: PracticeLocation[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = String(record.name ?? "").trim();
    if (!name) continue;
    const location: PracticeLocation = { name };
    const city = typeof record.city === "string" ? record.city.trim() : "";
    if (city) location.city = city;
    const address =
      typeof record.address === "string" ? record.address.trim() : "";
    if (address) location.address = address;
    const category =
      typeof record.category === "string" ? record.category.trim() : "";
    if (category) location.category = category;
    const categoryCustom =
      typeof record.categoryCustom === "string"
        ? record.categoryCustom.trim()
        : "";
    if (categoryCustom) location.categoryCustom = categoryCustom;
    locations.push(location);
  }
  return locations;
}

/** Statuts Stripe Connect Express stockés sur le club. */
export type StripeConnectStatus =
  | "not_connected"
  | "pending"
  | "complete"
  | "restricted";

/** Parse un document clubs/{clubId}. */
export function parseClub(
  id: string,
  data: Record<string, unknown>,
): ClubRecord {
  const adminIdsRaw = data[Fields.adminIds];
  const rawLogo = data[Fields.logoUrl];
  const rawBrand = data[Fields.brandColorHex];
  const rawStatus = String(data[Fields.stripeConnectStatus] ?? "not_connected");
  const stripeConnectStatus: StripeConnectStatus =
    rawStatus === "pending" ||
    rawStatus === "complete" ||
    rawStatus === "restricted"
      ? rawStatus
      : "not_connected";
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
    stripeConnectedAccountId: String(
      data[Fields.stripeConnectedAccountId] ?? "",
    ),
    stripeConnectStatus,
    seasonEndDate: toDate(data[Fields.seasonEndDate]),
    logoUrl:
      typeof rawLogo === "string" && rawLogo.trim() ? rawLogo.trim() : null,
    brandColorHex:
      typeof rawBrand === "string" && rawBrand.trim() ? rawBrand.trim() : null,
    createdAt: toDate(data[Fields.createdAt]),
    coachPermissions: parseCoachPermissions(data[Fields.coachPermissions]),
    practiceLocations: parsePracticeLocations(data[Fields.practiceLocations]),
  };
}

/** Charge un club par id. */
export async function getClub(clubId: string): Promise<ClubRecord | null> {
  const snap = await getDoc(doc(getAppFirestore(), Collections.clubs, clubId));
  if (!snap.exists()) return null;
  return parseClub(clubId, snap.data() as Record<string, unknown>);
}

/**
 * Charge plusieurs clubs. Ignore les absents et les refusés par les rules
 * (ex. membre retiré dont le profil référence encore le club). Une autre
 * erreur (réseau…) ne rejette que si aucun club n’a pu être lu.
 */
export async function getClubsByIds(clubIds: string[]): Promise<ClubRecord[]> {
  const uniqueIds = [...new Set(clubIds.filter(Boolean))];
  const results = await Promise.allSettled(uniqueIds.map((id) => getClub(id)));
  const clubs: ClubRecord[] = [];
  let firstError: unknown = null;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      if (result.value) clubs.push(result.value);
      return;
    }
    console.warn(`Club ${uniqueIds[index]} illisible`, result.reason);
    const code = (result.reason as { code?: unknown } | null)?.code;
    if (code !== "permission-denied") firstError ??= result.reason;
  });
  if (clubs.length === 0 && firstError !== null) throw firstError;
  return clubs;
}

/** Met à jour la config paiement en ligne (toggle CB) du club. */
export async function updateOnlinePaymentConfig(params: {
  clubId: string;
  enabled: boolean;
}): Promise<void> {
  await updateDoc(doc(getAppFirestore(), Collections.clubs, params.clubId), {
    [Fields.onlinePaymentEnabled]: params.enabled,
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
