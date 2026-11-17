import type { PracticeLocation } from "@/lib/clubSetup/clubSetupDraft";

/** Valeur du sélecteur Lieu pour une saisie libre ponctuelle. */
export const PRACTICE_LOCATION_OTHER_VALUE = "other";

/**
 * Libellé affiché / stocké pour un lieu de pratique
 * (aligné Flutter `addEventPracticeLocationLabel`).
 */
export function practiceLocationLabel(location: PracticeLocation): string {
  const address = location.address?.trim();
  if (address) return `${location.name} (${address})`;
  return location.name;
}

/**
 * Valeur initiale du sélecteur Lieu : index `0` si la liste n’est pas vide,
 * sinon `other` (saisie libre).
 */
export function defaultPracticeLocationSelectValue(
  locations: PracticeLocation[],
): string {
  return locations.length > 0 ? "0" : PRACTICE_LOCATION_OTHER_VALUE;
}

/**
 * Valeur du sélecteur correspondant à un lieu déjà stocké : index du lieu
 * club si reconnu, sinon `other` (saisie libre / adresse libre).
 */
export function practiceLocationSelectValueFor(
  locations: PracticeLocation[],
  location: string | null | undefined,
): string {
  const trimmed = location?.trim() ?? "";
  if (!trimmed || locations.length === 0) {
    return PRACTICE_LOCATION_OTHER_VALUE;
  }
  const index = locations.findIndex(
    (entry) =>
      practiceLocationLabel(entry) === trimmed || entry.name.trim() === trimmed,
  );
  return index >= 0 ? String(index) : PRACTICE_LOCATION_OTHER_VALUE;
}
