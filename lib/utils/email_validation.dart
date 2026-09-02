/// Format minimal `x@y.z` (pas d'espace, un seul `@`, un point dans le domaine).
final RegExp _emailFormatPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// Normalise un e-mail comme côté serveur : trim + minuscules.
String normalizeEmail(String rawEmail) => rawEmail.trim().toLowerCase();

/// `true` si [rawEmail] (une fois trimé) respecte le format `x@y.z`.
bool isValidEmailFormat(String rawEmail) =>
    _emailFormatPattern.hasMatch(rawEmail.trim());

/// Message d'erreur FR pour un e-mail obligatoire, `null` si l'e-mail est valide.
String? requiredEmailError(String rawEmail) {
  final trimmedEmail = rawEmail.trim();
  if (trimmedEmail.isEmpty) return 'L\'e-mail est obligatoire.';
  if (!isValidEmailFormat(trimmedEmail)) return 'Saisis un e-mail valide.';
  return null;
}
