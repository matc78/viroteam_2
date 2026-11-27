import type { PracticeLocation } from "@/lib/clubSetup/clubSetupDraft";
import { PracticeLocationCategories } from "@/lib/clubSetup/constants";
import {
  addressLineError,
  cityError,
  formatAddressLine,
  formatCity,
} from "@/lib/format/personDataFormat";

/** Saisie d’un lieu de pratique (formulaire des paramètres du club). */
export type PracticeLocationFormValues = {
  name: string;
  category: string;
  categoryCustom: string;
  city: string;
  address: string;
};

/** Formulaire vide, catégorie proposée selon le sport du club. */
export function emptyPracticeLocationForm(
  sport: string,
): PracticeLocationFormValues {
  return {
    name: "",
    category: PracticeLocationCategories.defaultForSport(sport),
    categoryCustom: "",
    city: "",
    address: "",
  };
}

/** Pré-remplit le formulaire avec un lieu existant (modification). */
export function practiceLocationToForm(
  location: PracticeLocation,
  sport: string,
): PracticeLocationFormValues {
  return {
    name: location.name,
    category:
      location.category || PracticeLocationCategories.defaultForSport(sport),
    categoryCustom: location.categoryCustom ?? "",
    city: location.city ?? "",
    address: location.address ?? "",
  };
}

/**
 * Premier problème bloquant du formulaire (message FR), `null` si valide.
 * Mêmes exigences que l’app : nom, catégorie, ville et adresse obligatoires.
 */
export function practiceLocationFormError(
  values: PracticeLocationFormValues,
): string | null {
  if (!values.name.trim()) return "Donne un nom au lieu.";
  if (!values.category) return "Choisis une catégorie.";
  if (
    values.category === PracticeLocationCategories.other &&
    !values.categoryCustom.trim()
  ) {
    return "Précise la catégorie.";
  }
  const city = cityError(values.city, { required: true });
  if (city) return city;
  if (!values.address.trim()) return "L’adresse est obligatoire.";
  return addressLineError(values.address);
}

/** Construit le lieu à enregistrer (formats ville / adresse appliqués). */
export function practiceLocationFromForm(
  values: PracticeLocationFormValues,
): PracticeLocation {
  const error = practiceLocationFormError(values);
  if (error) throw new Error(error);
  const isOther = values.category === PracticeLocationCategories.other;
  return {
    name: values.name.trim(),
    city: formatCity(values.city, { required: true }),
    address: formatAddressLine(values.address),
    category: values.category,
    ...(isOther ? { categoryCustom: values.categoryCustom.trim() } : {}),
  };
}

/**
 * Indique si [name] est déjà pris par un autre lieu (insensible à la casse
 * et aux accents) ; [ignoreIndex] exclut le lieu en cours de modification.
 */
export function isPracticeLocationNameTaken(
  locations: readonly PracticeLocation[],
  name: string,
  ignoreIndex: number | null = null,
): boolean {
  const key = normalizeLocationName(name);
  if (!key) return false;
  return locations.some(
    (location, index) =>
      index !== ignoreIndex && normalizeLocationName(location.name) === key,
  );
}

/** Sous-titre d’un lieu : catégorie · adresse · ville. */
export function practiceLocationDetails(location: PracticeLocation): string {
  const category = location.category
    ? PracticeLocationCategories.label(
        location.category,
        location.categoryCustom,
      )
    : "";
  return [category, location.address?.trim(), location.city?.trim()]
    .filter(Boolean)
    .join(" · ");
}

function normalizeLocationName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
