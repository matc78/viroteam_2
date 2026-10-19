import {
  CLUB_SETUP_DRAFT_KEY_PREFIX,
  CLUB_SETUP_LOGO_KEY_PREFIX,
  ClubMemberCountRanges,
  ClubSetupDefaults,
  ClubSetupSteps,
  ClubSports,
} from "./constants";
import {
  addressLineError,
  cityError,
  postalCodeError,
} from "@/lib/format/personDataFormat";

/** Lieu de pratique du club. */
export type PracticeLocation = {
  name: string;
  /** Ville du lieu de pratique. */
  city?: string;
  address?: string;
  /** Catégorie du lieu (city-stade, forêt, lac…). */
  category?: string;
  /** Libellé libre si catégorie = Autre. */
  categoryCustom?: string;
  /** Legacy brouillon — écarté à la restauration. */
  linkedToHeadquarters?: boolean;
};

/** Brouillon local du wizard création club. */
export type ClubSetupDraft = {
  name: string;
  sport: string;
  logoDataUrl: string | null;
  objectives: Set<string>;
  city: string;
  postalCode: string;
  address: string;
  practiceLocations: PracticeLocation[];
  description: string;
  currentStep: number;
  /** Étape la plus avancée déjà atteinte (icônes restent allumées au retour). */
  maxReachedStep: number;
  memberCountRange: string | null;
  brandColorHex: string;
};

export function createEmptyClubSetupDraft(): ClubSetupDraft {
  return {
    name: "",
    sport: ClubSports.all[0],
    logoDataUrl: null,
    objectives: new Set(),
    city: "",
    postalCode: "",
    address: "",
    practiceLocations: [],
    description: "",
    currentStep: ClubSetupSteps.prerequisites,
    maxReachedStep: ClubSetupSteps.prerequisites,
    memberCountRange: null,
    brandColorHex: ClubSetupDefaults.brandColorHex,
  };
}

export function canProceedIdentity(draft: ClubSetupDraft): boolean {
  return draft.name.trim().length >= 2 && draft.sport.length > 0;
}

export function canProceedObjectives(draft: ClubSetupDraft): boolean {
  return draft.objectives.size > 0;
}

export function canProceedInfo(draft: ClubSetupDraft): boolean {
  if (cityError(draft.city, { required: true })) return false;
  if (postalCodeError(draft.postalCode)) return false;
  if (addressLineError(draft.address)) return false;
  if (draft.practiceLocations.length === 0) return false;
  for (const location of draft.practiceLocations) {
    if (!location.name.trim()) return false;
    if (location.city && cityError(location.city)) return false;
    if (location.address && addressLineError(location.address)) return false;
  }
  return true;
}

export function hasSavedProgress(draft: ClubSetupDraft): boolean {
  return (
    draft.name.trim().length > 0 ||
    draft.city.trim().length > 0 ||
    draft.address.trim().length > 0 ||
    draft.description.trim().length > 0 ||
    draft.objectives.size > 0 ||
    draft.practiceLocations.length > 0 ||
    draft.memberCountRange !== null ||
    draft.logoDataUrl !== null ||
    draft.currentStep > 0 ||
    draft.brandColorHex !== ClubSetupDefaults.brandColorHex
  );
}

type SerializedDraft = {
  name: string;
  sport: string;
  hasLogo: boolean;
  objectives: string[];
  city: string;
  postalCode: string;
  address: string;
  practiceLocations: PracticeLocation[];
  description: string;
  currentStep: number;
  maxReachedStep?: number;
  memberCountRange: string | null;
  brandColorHex: string;
  /** Legacy — ignoré à la lecture. */
  useClubAddressAsFirstLocation?: boolean;
  wizardVersion: number;
};

/** Normalise un lieu pour persistance (sans flag siège legacy). */
function serializePracticeLocation(location: PracticeLocation): PracticeLocation {
  return {
    name: location.name,
    ...(location.city ? { city: location.city } : {}),
    ...(location.address ? { address: location.address } : {}),
    ...(location.category ? { category: location.category } : {}),
    ...(location.categoryCustom
      ? { categoryCustom: location.categoryCustom }
      : {}),
  };
}

/**
 * Restaure les lieux : écarte ceux liés au siège (auto-ajout legacy).
 */
function sanitizePracticeLocations(
  locations: PracticeLocation[],
): PracticeLocation[] {
  return locations
    .filter((location) => !location.linkedToHeadquarters)
    .map(serializePracticeLocation);
}

export function serializeClubSetupDraft(draft: ClubSetupDraft): SerializedDraft {
  return {
    name: draft.name,
    sport: draft.sport,
    hasLogo: draft.logoDataUrl !== null,
    objectives: [...draft.objectives],
    city: draft.city,
    postalCode: draft.postalCode,
    address: draft.address,
    practiceLocations: sanitizePracticeLocations(draft.practiceLocations),
    description: draft.description,
    currentStep: draft.currentStep,
    maxReachedStep: draft.maxReachedStep,
    memberCountRange: draft.memberCountRange,
    brandColorHex: draft.brandColorHex,
    wizardVersion: ClubSetupSteps.wizardVersion,
  };
}

export function deserializeClubSetupDraft(
  json: SerializedDraft,
  logoDataUrl: string | null,
): ClubSetupDraft {
  const wizardVersion = json.wizardVersion ?? 1;
  const currentStep = ClubSetupSteps.normalizePersistedStep(
    json.currentStep ?? 0,
    wizardVersion,
  );
  const maxReachedStep = Math.max(
    currentStep,
    json.maxReachedStep == null
      ? currentStep
      : ClubSetupSteps.normalizePersistedStep(json.maxReachedStep, wizardVersion),
  );

  const practiceLocations = sanitizePracticeLocations(
    (json.practiceLocations ?? []).map((location) => ({
      name: location.name ?? "",
      ...(location.city ? { city: location.city } : {}),
      address: location.address,
      ...(location.category ? { category: location.category } : {}),
      ...(location.categoryCustom
        ? { categoryCustom: location.categoryCustom }
        : {}),
      ...(location.linkedToHeadquarters ? { linkedToHeadquarters: true } : {}),
    })),
  );

  return {
    name: json.name ?? "",
    sport: json.sport ?? ClubSports.all[0],
    logoDataUrl: json.hasLogo ? logoDataUrl : null,
    objectives: new Set(json.objectives ?? []),
    city: json.city ?? "",
    postalCode: json.postalCode ?? "",
    address: json.address ?? "",
    practiceLocations,
    description: json.description ?? "",
    currentStep,
    maxReachedStep,
    memberCountRange: ClubMemberCountRanges.migratePersisted(
      json.memberCountRange,
    ),
    brandColorHex: json.brandColorHex ?? ClubSetupDefaults.brandColorHex,
  };
}

export function draftStorageKey(userId: string): string {
  return `${CLUB_SETUP_DRAFT_KEY_PREFIX}${userId}`;
}

export function logoStorageKey(userId: string): string {
  return `${CLUB_SETUP_LOGO_KEY_PREFIX}${userId}`;
}

/** Persiste le brouillon JSON (sans le logo). */
export function persistDraftToStorage(userId: string, draft: ClubSetupDraft): void {
  if (typeof window === "undefined") return;
  const payload = serializeClubSetupDraft(draft);
  window.localStorage.setItem(draftStorageKey(userId), JSON.stringify(payload));
}

/** Charge le brouillon depuis localStorage. */
export function loadDraftFromStorage(userId: string): ClubSetupDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(draftStorageKey(userId));
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as SerializedDraft;
    const logoDataUrl = window.localStorage.getItem(logoStorageKey(userId));
    return deserializeClubSetupDraft(json, logoDataUrl);
  } catch (error) {
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error, {
        level: "warning",
        tags: { feature: "club_setup", area: "draft_parse" },
      });
    });
    return null;
  }
}

/** Persiste le logo en data URL. */
export function persistLogoToStorage(userId: string, logoDataUrl: string | null): void {
  if (typeof window === "undefined") return;
  const key = logoStorageKey(userId);
  if (!logoDataUrl) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, logoDataUrl);
}

/** Efface brouillon et logo. */
export function clearDraftStorage(userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(draftStorageKey(userId));
  window.localStorage.removeItem(logoStorageKey(userId));
}

/** Convertit une data URL en bytes pour l’upload Storage. */
export function dataUrlToBytes(dataUrl: string): { bytes: ArrayBuffer; contentType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { bytes: bytes.buffer, contentType };
}
