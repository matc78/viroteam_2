/** Formatage et validation des données personnelles / adresse / licence. */

const PERSON_NAME_ALLOWED =
  /^[\p{L}]+(?:['’\-][\p{L}]+)*(?: [\p{L}]+(?:['’\-][\p{L}]+)*)*$/u;

const ADDRESS_ALLOWED = /^[\p{L}\p{N} ,.\-'’/°#]+$/u;

const CITY_ALLOWED =
  /^[\p{L}]+(?:['’\-][\p{L}]+)*(?: [\p{L}]+(?:['’\-][\p{L}]+)*)*$/u;

const POSTAL_CODE_PATTERN = /^\d{5}$/;

const LICENSE_ALLOWED = /^[A-Za-z0-9]+$/;

/** Message d’erreur FR pour un prénom, `null` si valide. */
export function firstNameError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Le prénom est obligatoire.";
  if (!PERSON_NAME_ALLOWED.test(trimmed)) {
    return "Le prénom ne peut contenir que des lettres, espaces, tirets ou apostrophes.";
  }
  return null;
}

/** Message d’erreur FR pour un nom de famille, `null` si valide. */
export function lastNameError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Le nom est obligatoire.";
  if (!PERSON_NAME_ALLOWED.test(trimmed)) {
    return "Le nom ne peut contenir que des lettres, espaces, tirets ou apostrophes.";
  }
  return null;
}

/** Capitalise chaque mot / segment composé (ex. `jean-pierre` → `Jean-Pierre`). */
export function formatFirstName(raw: string): string {
  const error = firstNameError(raw);
  if (error) throw new Error(error);
  return titleCasePersonName(raw.trim());
}

/** Met le nom de famille entièrement en majuscules. */
export function formatLastName(raw: string): string {
  const error = lastNameError(raw);
  if (error) throw new Error(error);
  return raw.trim().toLocaleUpperCase("fr-FR");
}

/** Message d’erreur FR pour une ligne d’adresse (vide OK). */
export function addressLineError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!ADDRESS_ALLOWED.test(trimmed)) {
    return "L'adresse ne peut pas contenir d'emoji ni de caractères spéciaux.";
  }
  return null;
}

/** Trim + validation adresse ; chaîne vide si entrée vide. */
export function formatAddressLine(raw: string): string {
  const error = addressLineError(raw);
  if (error) throw new Error(error);
  return raw.trim();
}

/** Message d’erreur FR pour une ville (vide OK sauf si `required`). */
export function cityError(
  raw: string,
  options?: { required?: boolean },
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return options?.required ? "La ville est obligatoire." : null;
  }
  if (!CITY_ALLOWED.test(trimmed)) {
    return "La ville ne peut contenir que des lettres, espaces, tirets ou apostrophes.";
  }
  return null;
}

/** Capitalise la ville comme un prénom ; chaîne vide si entrée vide. */
export function formatCity(
  raw: string,
  options?: { required?: boolean },
): string {
  const error = cityError(raw, options);
  if (error) throw new Error(error);
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return titleCasePersonName(trimmed);
}

/** Message d’erreur FR pour un code postal (vide OK ; sinon 5 chiffres). */
export function postalCodeError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!POSTAL_CODE_PATTERN.test(trimmed)) {
    return "Le code postal doit contenir exactement 5 chiffres.";
  }
  return null;
}

/** Trim + validation CP ; chaîne vide si entrée vide. */
export function formatPostalCode(raw: string): string {
  const error = postalCodeError(raw);
  if (error) throw new Error(error);
  return raw.trim();
}

/** Message d’erreur FR pour une licence (vide OK ; sinon lettres/chiffres). */
export function licenseError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!LICENSE_ALLOWED.test(trimmed)) {
    return "La licence ne peut contenir que des lettres et des chiffres.";
  }
  return null;
}

/** Trim + majuscules ; chaîne vide si entrée vide. */
export function formatLicense(raw: string): string {
  const error = licenseError(raw);
  if (error) throw new Error(error);
  return raw.trim().toUpperCase();
}

/** Formate un prénom ; vide si entrée vide. */
export function formatFirstNameOrEmpty(raw: string): string {
  if (!raw.trim()) return "";
  return formatFirstName(raw);
}

/** Formate un nom ; vide si entrée vide. */
export function formatLastNameOrEmpty(raw: string): string {
  if (!raw.trim()) return "";
  return formatLastName(raw);
}

/** Formate un prénom en ignorant les valeurs invalides (OAuth / bootstrap). */
export function softFormatFirstName(raw: string): string {
  try {
    return formatFirstNameOrEmpty(raw);
  } catch {
    return "";
  }
}

/** Formate un nom en ignorant les valeurs invalides (OAuth / bootstrap). */
export function softFormatLastName(raw: string): string {
  try {
    return formatLastNameOrEmpty(raw);
  } catch {
    return "";
  }
}

function titleCasePersonName(value: string): string {
  let result = "";
  let capitalizeNext = true;
  for (const char of value) {
    if (char === " " || char === "-" || char === "'" || char === "’") {
      result += char;
      capitalizeNext = true;
      continue;
    }
    if (capitalizeNext) {
      result += char.toLocaleUpperCase("fr-FR");
      capitalizeNext = false;
    } else {
      result += char.toLocaleLowerCase("fr-FR");
    }
  }
  return result;
}
