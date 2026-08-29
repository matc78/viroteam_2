/** Politique mot de passe ViroTeam (inscription + changement). */
export const PASSWORD_POLICY_HINT =
  "8 caractères minimum, avec une majuscule, une minuscule et un chiffre.";

const MIN_LENGTH = 8;
const HAS_UPPERCASE = /[A-ZÀ-ÖØ-Þ]/;
const HAS_LOWERCASE = /[a-zà-öø-ÿ]/;
const HAS_DIGIT = /[0-9]/;

/** Retourne `null` si valide, sinon un message d’erreur en français. */
export function validatePassword(password: string | null | undefined): string | null {
  const value = password ?? "";
  if (!value) return "Le mot de passe est requis.";
  if (value.length < MIN_LENGTH) return `Au moins ${MIN_LENGTH} caractères.`;
  if (!HAS_UPPERCASE.test(value)) return "Au moins une majuscule.";
  if (!HAS_LOWERCASE.test(value)) return "Au moins une minuscule.";
  if (!HAS_DIGIT.test(value)) return "Au moins un chiffre.";
  return null;
}

export function isPasswordValid(password: string): boolean {
  return validatePassword(password) === null;
}
