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
