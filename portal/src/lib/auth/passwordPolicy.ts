/** Politique mot de passe ViroTeam (inscription + changement). */
export const PASSWORD_POLICY_HINT =
  "8 caractères minimum, avec une majuscule, une minuscule et un chiffre.";

const MIN_LENGTH = 8;
const HAS_UPPERCASE = /[A-ZÀ-ÖØ-Þ]/;
const HAS_LOWERCASE = /[a-zà-öø-ÿ]/;
const HAS_DIGIT = /[0-9]/;

/** Une règle de la politique, avec son état d’évaluation. */
export type PasswordRequirement = {
  id: "length" | "uppercase" | "lowercase" | "digit";
  label: string;
  met: boolean;
};

/** Évalue chaque règle séparément (checklist UI dynamique). */
export function passwordRequirements(
  password: string | null | undefined,
): PasswordRequirement[] {
  const value = password ?? "";
  return [
    {
      id: "length",
      label: `${MIN_LENGTH} caractères`,
      met: value.length >= MIN_LENGTH,
    },
    {
      id: "uppercase",
      label: "1 majuscule",
      met: HAS_UPPERCASE.test(value),
    },
    {
      id: "lowercase",
      label: "1 minuscule",
      met: HAS_LOWERCASE.test(value),
    },
    {
      id: "digit",
      label: "1 chiffre",
      met: HAS_DIGIT.test(value),
    },
  ];
}

/** Retourne `null` si valide, sinon un message d’erreur en français. */
export function validatePassword(password: string | null | undefined): string | null {
  const value = password ?? "";
  if (!value) return "Le mot de passe est requis.";
  const unmet = passwordRequirements(value).find((requirement) => !requirement.met);
  if (!unmet) return null;
  switch (unmet.id) {
    case "length":
      return `Au moins ${MIN_LENGTH} caractères.`;
    case "uppercase":
      return "Au moins une majuscule.";
    case "lowercase":
      return "Au moins une minuscule.";
    case "digit":
      return "Au moins un chiffre.";
  }
}

/** Indique si le mot de passe respecte toute la politique. */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password) === null;
}
