import { HttpsError } from "firebase-functions/v2/https";

/**
 * Validation pure du payload de `createClub` (testable sans Firestore).
 * La mise en forme (casse de la ville, adresse…) est faite par les clients ;
 * le serveur borne et nettoie.
 */

const MAX_NAME = 100;
const MAX_SHORT = 120;
const MAX_ADDRESS = 250;
const MAX_DESCRIPTION = 2000;
const MAX_COLOR = 16;
const MAX_LOCATIONS = 30;

export type PracticeLocationInput = {
  name: string;
  city?: string;
  address?: string;
  category?: string;
  categoryCustom?: string;
};

export type CreateClubArgs = {
  name: string;
  sport: string;
  city: string;
  postalCode: string;
  address: string;
  description: string;
  brandColorHex: string;
  practiceLocations: PracticeLocationInput[];
  /** Fin de saison sportive (millisecondes epoch). */
  seasonEndDateMs: number;
};

function text(value: unknown, name: string, max: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${name} invalide`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new HttpsError("invalid-argument", `${name} trop long`);
  }
  return trimmed;
}

function requiredText(value: unknown, name: string, max: number): string {
  const trimmed = text(value, name, max);
  if (!trimmed) throw new HttpsError("invalid-argument", `${name} requis`);
  return trimmed;
}

function parseLocation(raw: unknown): PracticeLocationInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpsError("invalid-argument", "Lieu de pratique invalide");
  }
  const item = raw as Record<string, unknown>;
  const location: PracticeLocationInput = {
    name: requiredText(item.name, "Nom du lieu", MAX_SHORT),
  };
  const optional = {
    city: text(item.city, "Ville du lieu", MAX_SHORT),
    address: text(item.address, "Adresse du lieu", MAX_ADDRESS),
    category: text(item.category, "Catégorie du lieu", MAX_SHORT),
    categoryCustom: text(item.categoryCustom, "Catégorie du lieu", MAX_SHORT),
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value) location[key as keyof typeof optional] = value;
  }
  return location;
}

/** Valide le brouillon de club envoyé par l'app ou le portail. */
export function parseCreateClubArgs(data: unknown): CreateClubArgs {
  const payload = (data ?? {}) as Record<string, unknown>;
  const rawLocations = payload.practiceLocations ?? [];
  if (!Array.isArray(rawLocations) || rawLocations.length > MAX_LOCATIONS) {
    throw new HttpsError("invalid-argument", "Lieux de pratique invalides");
  }
  const seasonEndDateMs = payload.seasonEndDateMs;
  if (typeof seasonEndDateMs !== "number" || !Number.isFinite(seasonEndDateMs)) {
    throw new HttpsError("invalid-argument", "Date de fin de saison requise");
  }
  return {
    name: requiredText(payload.name, "Nom du club", MAX_NAME),
    sport: requiredText(payload.sport, "Sport", MAX_SHORT),
    city: requiredText(payload.city, "Ville", MAX_SHORT),
    postalCode: text(payload.postalCode, "Code postal", MAX_SHORT),
    address: text(payload.address, "Adresse", MAX_ADDRESS),
    description: text(payload.description, "Description", MAX_DESCRIPTION),
    brandColorHex: requiredText(payload.brandColorHex, "Couleur", MAX_COLOR),
    practiceLocations: rawLocations.map(parseLocation),
    seasonEndDateMs,
  };
}
