import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';

/// Couleurs résolues pour l'affichage club.
class ClubBrandColors {
  const ClubBrandColors({
    required this.primary,
    this.secondary,
  });

  final Color primary;
  final Color? secondary;

  bool get isBicolor => secondary != null;

  /// Couleur zone membre (accès rapides, planning perso…).
  Color get memberZoneColor => primary;

  /// Couleur zone gestion (coach / admin) ; retombe sur [primary] si uni.
  Color get managementZoneColor => secondary ?? primary;
}

/// Palette picker — ordre arc-en-ciel explicite (clair → foncé par famille).
const List<Color> _basePresetColors = [
  // Rouge → rose
  Color(0xFFDC2626),
  Color(0xFFE11D48),
  Color(0xFFBE185D),
  Color(0xFFDB2777),
  // Orange → ambre
  Color(0xFFF97316),
  Color(0xFFEA580C),
  Color(0xFFCA8A04),
  // Vert
  Color(0xFF22C55E),
  Color(0xFF65A30D),
  Color(0xFF10B981),
  Color(0xFF059669),
  // Teal → cyan
  Color(0xFF14B8A6),
  Color(0xFF0D9488),
  Color(0xFF0891B2),
  // Bleu
  Color(0xFF2563EB),
  Color(0xFF0284C7),
  ViroColors.primary400,
  ViroColors.primary600,
  ViroColors.primary800,
  // Violet → indigo
  Color(0xFF8B5CF6),
  Color(0xFF7C3AED),
  Color(0xFF4F46E5),
  // Neutres
  Color(0xFF78350F),
  Color(0xFF475569),
  Color(0xFF171717),
];

/// Hex interdits dans le picker (blanc et teintes trop claires).
const Set<String> _blockedPickerHexes = {
  '#FFFFFF',
  '#FACC15',
  '#9BB8DC',
  '#F4F6F9',
  '#ECEFF4',
};

/// Couleur autorisée pour la marque club (contraste suffisant sur fond blanc).
bool isAllowedClubBrandColor(Color color) {
  final hex = colorToHex(color);
  if (_blockedPickerHexes.contains(hex)) return false;
  return color.computeLuminance() <= 0.72;
}

/// Exclut le blanc et les teintes trop claires du picker.
bool _isExcludedPickerColor(Color color) => !isAllowedClubBrandColor(color);

/// Palette unique pour les sections « unies » et « bicolores » du picker.
List<Color> buildClubBrandColorPresets() {
  final seen = <String>{};
  final presets = <Color>[];

  for (final color in _basePresetColors) {
    final hex = colorToHex(color);
    if (_blockedPickerHexes.contains(hex)) continue;
    if (_isExcludedPickerColor(color)) continue;
    if (seen.add(hex)) presets.add(color);
  }

  return presets;
}

/// Palette picker — recalculée à chaque accès (évite cache stale au hot reload).
List<Color> get clubBrandColorPresets => buildClubBrandColorPresets();

/// Tokens d'accent club — alphas harmonisés avec home / planning.
class ClubAccentStyle {
  ClubAccentStyle(this.accent, {this.secondary});

  final Color accent;
  final Color? secondary;

  Color get border => accent.withValues(alpha: 0.35);
  Color get surfaceTint => accent.withValues(alpha: 0.08);
  Color get chipFill => accent.withValues(alpha: 0.15);
  Color get iconFill => accent.withValues(alpha: 0.12);

  List<Color> get accentGradient => [
        accent,
        secondary ?? accent.withValues(alpha: 0.5),
      ];
}

/// Convertit une [Color] en hex `#RRGGBB`.
String colorToHex(Color color) {
  final value = color.toARGB32() & 0xFFFFFF;
  return '#${value.toRadixString(16).padLeft(6, '0').toUpperCase()}';
}

/// Parse un hex `#RRGGBB` ; retourne `null` si invalide.
Color? parseBrandColorHex(String hex) {
  final normalized = hex.replaceFirst('#', '').trim();
  if (normalized.length != 6) return null;
  final value = int.tryParse(normalized, radix: 16);
  if (value == null) return null;
  return Color(0xFF000000 | value);
}

/// Parse la valeur Firestore (`#RRGGBB` ou `#RRGGBB+#RRGGBB`).
ClubBrandColors? parseClubBrandColorsFromStorage(String? value) {
  if (value == null || value.trim().isEmpty) return null;

  final parts = value.split('+');
  if (parts.length == 1) {
    final primary = parseBrandColorHex(parts.first);
    if (primary == null) return null;
    return ClubBrandColors(primary: primary);
  }
  if (parts.length == 2) {
    final primary = parseBrandColorHex(parts[0]);
    final secondary = parseBrandColorHex(parts[1]);
    if (primary == null || secondary == null) return null;
    return ClubBrandColors(primary: primary, secondary: secondary);
  }
  return null;
}

/// Corrige une valeur Firestore invalide ou trop claire (ex. blanc).
String sanitizeBrandColorHex(
  String? stored, {
  String fallback = '#134A7D',
}) {
  if (stored == null || stored.trim().isEmpty) return fallback;

  final parsed = parseClubBrandColorsFromStorage(stored);
  if (parsed == null) return fallback;
  if (!isAllowedClubBrandColor(parsed.primary)) return fallback;

  final primaryHex = colorToHex(parsed.primary);
  if (_blockedPickerHexes.contains(primaryHex)) return fallback;
  if (parsed.secondary == null) return primaryHex;
  if (!isAllowedClubBrandColor(parsed.secondary!)) return primaryHex;

  return encodeBrandColorHex(
    primary: primaryHex,
    secondary: colorToHex(parsed.secondary!),
  );
}

/// Décompose une valeur Firestore en couleurs primaire et secondaire optionnelle.
({String primary, String? secondary}) splitBrandColorHex(String stored) {
  final sanitized = sanitizeBrandColorHex(stored);
  final parsed = parseClubBrandColorsFromStorage(sanitized);
  if (parsed == null) {
    return (primary: sanitized, secondary: null);
  }

  final primary = colorToHex(parsed.primary);
  final secondary =
      parsed.secondary != null ? colorToHex(parsed.secondary!) : null;
  return (primary: primary, secondary: secondary);
}

/// Reconstruit la chaîne Firestore à partir des sélections du picker.
String encodeBrandColorHex({required String primary, String? secondary}) {
  final normalizedPrimary = primary.trim().toUpperCase();
  final normalizedSecondary = secondary?.trim().toUpperCase();

  if (normalizedSecondary == null ||
      normalizedSecondary.isEmpty ||
      normalizedSecondary == normalizedPrimary) {
    return normalizedPrimary;
  }

  return '$normalizedPrimary+$normalizedSecondary';
}

/// Compare deux valeurs stockées (insensible à la casse).
bool clubBrandColorsMatch(String? a, String? b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a.trim().toUpperCase() == b.trim().toUpperCase();
}

/// Résout les couleurs de marque depuis Firestore ou fallback stable.
ClubBrandColors resolveClubBrandColors({
  String? brandColorHex,
  required String clubId,
}) {
  final sanitized = sanitizeBrandColorHex(brandColorHex, fallback: '');
  if (sanitized.isNotEmpty) {
    final parsed = parseClubBrandColorsFromStorage(sanitized);
    if (parsed != null) return parsed;
  }

  final hash = clubId.hashCode.abs();
  final fallback = clubBrandColorPresets[hash % clubBrandColorPresets.length];
  return ClubBrandColors(primary: fallback);
}

/// Couleur d'accent principale (compatibilité existante).
Color clubAccentColor({String? brandColorHex, required String clubId}) {
  return resolveClubBrandColors(
    brandColorHex: brandColorHex,
    clubId: clubId,
  ).primary;
}

/// Style accent avec support bicolore.
ClubAccentStyle clubAccentStyle({
  String? brandColorHex,
  required String clubId,
}) {
  final colors = resolveClubBrandColors(
    brandColorHex: brandColorHex,
    clubId: clubId,
  );
  return ClubAccentStyle(colors.primary, secondary: colors.secondary);
}
