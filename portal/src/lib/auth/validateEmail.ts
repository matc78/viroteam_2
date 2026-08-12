const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valide un e-mail et retourne un message d’erreur ou `undefined` si valide. */
export function validateEmail(email: string): string | undefined {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return "L’e-mail est requis.";
  }
  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return "Saisis un e-mail valide.";
  }
  return undefined;
}
