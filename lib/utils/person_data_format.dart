/// Formatage et validation des données personnelles / adresse / licence
/// à l’enregistrement (rejet si caractères interdits).
library;

final RegExp _personNameAllowedPattern = RegExp(
  r"^[\p{L}]+(?:['’\-][\p{L}]+)*(?: [\p{L}]+(?:['’\-][\p{L}]+)*)*$",
  unicode: true,
);

final RegExp _addressAllowedPattern = RegExp(
  r"^[\p{L}\p{N} ,.\-'’/°#]+$",
  unicode: true,
);

final RegExp _cityAllowedPattern = RegExp(
  r"^[\p{L}]+(?:['’\-][\p{L}]+)*(?: [\p{L}]+(?:['’\-][\p{L}]+)*)*$",
  unicode: true,
);

final RegExp _postalCodePattern = RegExp(r'^\d{5}$');

final RegExp _licenseAllowedPattern = RegExp(r'^[A-Za-z0-9]+$');

/// Message d’erreur FR pour un prénom, `null` si valide (non vide + caractères OK).
String? firstNameError(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return 'Le prénom est obligatoire.';
  if (!_personNameAllowedPattern.hasMatch(trimmed)) {
    return 'Le prénom ne peut contenir que des lettres, espaces, tirets ou apostrophes.';
  }
  return null;
}

/// Message d’erreur FR pour un nom de famille, `null` si valide.
String? lastNameError(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return 'Le nom est obligatoire.';
  if (!_personNameAllowedPattern.hasMatch(trimmed)) {
    return 'Le nom ne peut contenir que des lettres, espaces, tirets ou apostrophes.';
  }
  return null;
}

/// Capitalise chaque mot / segment composé (ex. `jean-pierre` → `Jean-Pierre`).
String formatFirstName(String raw) {
  final error = firstNameError(raw);
  if (error != null) throw ArgumentError(error);
  return _titleCasePersonName(raw.trim());
}

/// Met le nom de famille entièrement en majuscules.
String formatLastName(String raw) {
  final error = lastNameError(raw);
  if (error != null) throw ArgumentError(error);
  return raw.trim().toUpperCase();
}

/// Message d’erreur FR pour une ligne d’adresse (vide OK).
String? addressLineError(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;
  if (!_addressAllowedPattern.hasMatch(trimmed)) {
    return 'L\'adresse ne peut pas contenir d\'emoji ni de caractères spéciaux.';
  }
  return null;
}

/// Trim + validation adresse ; chaîne vide si entrée vide.
String formatAddressLine(String raw) {
  final error = addressLineError(raw);
  if (error != null) throw ArgumentError(error);
  return raw.trim();
}

/// Message d’erreur FR pour une ville (vide OK sauf si [required]).
String? cityError(String raw, {bool required = false}) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) {
    return required ? 'La ville est obligatoire.' : null;
  }
  if (!_cityAllowedPattern.hasMatch(trimmed)) {
    return 'La ville ne peut contenir que des lettres, espaces, tirets ou apostrophes.';
  }
  return null;
}

/// Capitalise la ville comme un prénom ; chaîne vide si entrée vide.
String formatCity(String raw, {bool required = false}) {
  final error = cityError(raw, required: required);
  if (error != null) throw ArgumentError(error);
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return '';
  return _titleCasePersonName(trimmed);
}

/// Message d’erreur FR pour un code postal (vide OK ; sinon exactement 5 chiffres).
String? postalCodeError(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;
  if (!_postalCodePattern.hasMatch(trimmed)) {
    return 'Le code postal doit contenir exactement 5 chiffres.';
  }
  return null;
}

/// Trim + validation CP ; chaîne vide si entrée vide.
String formatPostalCode(String raw) {
  final error = postalCodeError(raw);
  if (error != null) throw ArgumentError(error);
  return raw.trim();
}

/// Message d’erreur FR pour une licence (vide OK ; sinon lettres/chiffres).
String? licenseError(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;
  if (!_licenseAllowedPattern.hasMatch(trimmed)) {
    return 'La licence ne peut contenir que des lettres et des chiffres.';
  }
  return null;
}

/// Trim + majuscules lettres ; chaîne vide si entrée vide.
String formatLicense(String raw) {
  final error = licenseError(raw);
  if (error != null) throw ArgumentError(error);
  return raw.trim().toUpperCase();
}

String _titleCasePersonName(String value) {
  final buffer = StringBuffer();
  var capitalizeNext = true;
  for (final rune in value.runes) {
    final char = String.fromCharCode(rune);
    if (char == ' ' || char == '-' || char == "'" || char == '’') {
      buffer.write(char);
      capitalizeNext = true;
      continue;
    }
    if (capitalizeNext) {
      buffer.write(char.toUpperCase());
      capitalizeNext = false;
    } else {
      buffer.write(char.toLowerCase());
    }
  }
  return buffer.toString();
}
