import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';

/// Palette sémantique dépendante du thème (clair / sombre).
///
/// Les features lisent les couleurs neutres et de marque via
/// `context.viroPalette`, jamais via `ViroColors.gray*` / `primary*` : seules
/// les couleurs vives (sport, sémantiques, badges de rôle) restent des
/// constantes partagées par les deux modes.
@immutable
class ViroPalette extends ThemeExtension<ViroPalette> {
  const ViroPalette({
    required this.brightness,
    required this.background,
    required this.surface,
    required this.surfaceCard,
    required this.surfaceSubtle,
    required this.surfaceMuted,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.border,
    required this.borderStrong,
    required this.brandText,
    required this.brandStrong,
    required this.accent,
    required this.accentMid,
    required this.accentSoft,
    required this.accentSofter,
    required this.accentFill,
    required this.accentFillHover,
    required this.accentFillPressed,
    required this.onAccent,
    required this.errorText,
    required this.warningText,
    required this.successText,
    required this.cardBorder,
    required this.shadowTint,
    required this.shadowStrength,
    required this.decorOpacityFactor,
  });

  final Brightness brightness;

  /// Fond d'écran (sous les formes décoratives de `ViroScaffold`).
  final Color background;

  /// Surface légèrement détachée du fond (bandeaux, zones de saisie).
  final Color surface;

  /// Fond des cartes, sheets, dialogs, menus et champs.
  final Color surfaceCard;

  /// Remplissage discret (chips, pastilles, lignes alternées) — ex-`gray50`.
  final Color surfaceSubtle;

  /// Remplissage un cran plus marqué — ex-`gray100`.
  final Color surfaceMuted;

  /// Texte principal — ex-`gray900`.
  final Color textPrimary;

  /// Texte secondaire — ex-`gray600`.
  final Color textSecondary;

  /// Texte discret, placeholders — ex-`gray400`.
  final Color textMuted;

  /// Séparateurs et bordures fines — ex-`gray200`.
  final Color border;

  /// Bordures de champs, poignées — ex-`gray300`.
  final Color borderStrong;

  /// Titres et texte de marque — ex-`primary800`.
  final Color brandText;

  /// Texte de marque le plus fort — ex-`primary900`.
  final Color brandStrong;

  /// Liens, icônes et accents en premier plan — ex-`primary600`.
  final Color accent;

  /// Accent intermédiaire (icônes secondaires, formes) — ex-`primary200/400`.
  final Color accentMid;

  /// Teinte d'accent douce (bordures, fonds sélectionnés) — ex-`primary100`.
  final Color accentSoft;

  /// Teinte d'accent très douce (fonds de pastilles) — ex-`primary50`.
  final Color accentSofter;

  /// Fond des boutons primaires / FAB (texte [onAccent] par-dessus).
  final Color accentFill;
  final Color accentFillHover;
  final Color accentFillPressed;

  /// Texte / icône posé sur [accentFill] ou une couleur vive.
  final Color onAccent;

  /// Variantes lisibles de `ViroColors.error/warning/success` pour du texte.
  final Color errorText;
  final Color warningText;
  final Color successText;

  /// Bordure de `ViroCard`.
  final Color cardBorder;

  /// Teinte des ombres portées et intensité relative (1 = mode clair).
  final Color shadowTint;
  final double shadowStrength;

  /// Multiplicateur d'opacité des formes décoratives de fond.
  final double decorOpacityFactor;

  bool get isDark => brightness == Brightness.dark;

  /// Rend une couleur de marque club lisible sur le fond courant : en sombre,
  /// la couleur est éclaircie (luminosité HSL ≥ 0,68) et ravivée (saturation
  /// ≥ 0,75 si elle est teintée) pour rester vive sur le bleu nuit.
  Color readableAccent(Color color) {
    if (!isDark) return color;
    final hsl = HSLColor.fromColor(color);
    final isTinted = hsl.saturation > 0.15;
    return hsl
        .withLightness(hsl.lightness < 0.68 ? 0.68 : hsl.lightness)
        .withSaturation(
          isTinted && hsl.saturation < 0.75 ? 0.75 : hsl.saturation,
        )
        .toColor();
  }

  /// Halo « néon » autour d'un texte ou d'une icône de [color] en sombre ;
  /// liste vide en clair (aucun effet).
  List<Shadow> neonGlow(Color color, {double blur = 10}) {
    if (!isDark) return const [];
    return [Shadow(color: color.withValues(alpha: 0.55), blurRadius: blur)];
  }

  /// Équivalent de [neonGlow] pour une boîte (bouton rond, pastille).
  List<BoxShadow> neonBoxGlow(Color color, {double blur = 12}) {
    if (!isDark) return const [];
    return [BoxShadow(color: color.withValues(alpha: 0.45), blurRadius: blur)];
  }

  static const ViroPalette light = ViroPalette(
    brightness: Brightness.light,
    background: ViroColors.white,
    surface: ViroColors.surface,
    surfaceCard: ViroColors.surfaceCard,
    surfaceSubtle: ViroColors.gray50,
    surfaceMuted: ViroColors.gray100,
    textPrimary: ViroColors.gray900,
    textSecondary: ViroColors.gray600,
    textMuted: ViroColors.gray400,
    border: ViroColors.gray200,
    borderStrong: ViroColors.gray300,
    brandText: ViroColors.primary800,
    brandStrong: ViroColors.primary900,
    accent: ViroColors.primary600,
    accentMid: ViroColors.primary200,
    accentSoft: ViroColors.primary100,
    accentSofter: ViroColors.primary50,
    accentFill: ViroColors.primary600,
    accentFillHover: ViroColors.primary800,
    accentFillPressed: ViroColors.primary900,
    onAccent: ViroColors.white,
    errorText: ViroColors.error,
    warningText: ViroColors.warning,
    successText: ViroColors.success,
    cardBorder: Color(0x739BB8DC), // primary100 à 45 %
    shadowTint: ViroColors.primary600,
    shadowStrength: 1,
    decorOpacityFactor: 1,
  );

  static const ViroPalette dark = ViroPalette(
    brightness: Brightness.dark,
    background: Color(0xFF0B1220),
    surface: Color(0xFF111A2A),
    surfaceCard: Color(0xFF162133),
    surfaceSubtle: Color(0xFF1B2739),
    surfaceMuted: Color(0xFF223044),
    textPrimary: Color(0xFFE6EBF2),
    textSecondary: Color(0xFFA9B4C4),
    textMuted: Color(0xFF77839A),
    border: Color(0xFF27344A),
    borderStrong: Color(0xFF354561),
    brandText: Color(0xFFEFF5FF),
    brandStrong: Color(0xFFF7FAFF),
    accent: Color(0xFF8CCBFF),
    accentMid: Color(0xFF5FA3E6),
    accentSoft: Color(0xFF2A4A70),
    accentSofter: Color(0xFF1B3150),
    accentFill: Color(0xFF2C6AA6),
    accentFillHover: Color(0xFF3577B6),
    accentFillPressed: Color(0xFF245A8E),
    onAccent: ViroColors.white,
    errorText: Color(0xFFF87171),
    warningText: Color(0xFFFBBF24),
    successText: Color(0xFF34D399),
    cardBorder: Color(0xFF223147),
    shadowTint: Color(0xFF000000),
    shadowStrength: 2.5,
    decorOpacityFactor: 0.55,
  );

  @override
  ViroPalette copyWith({
    Brightness? brightness,
    Color? background,
    Color? surface,
    Color? surfaceCard,
    Color? surfaceSubtle,
    Color? surfaceMuted,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? border,
    Color? borderStrong,
    Color? brandText,
    Color? brandStrong,
    Color? accent,
    Color? accentMid,
    Color? accentSoft,
    Color? accentSofter,
    Color? accentFill,
    Color? accentFillHover,
    Color? accentFillPressed,
    Color? onAccent,
    Color? errorText,
    Color? warningText,
    Color? successText,
    Color? cardBorder,
    Color? shadowTint,
    double? shadowStrength,
    double? decorOpacityFactor,
  }) {
    return ViroPalette(
      brightness: brightness ?? this.brightness,
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceCard: surfaceCard ?? this.surfaceCard,
      surfaceSubtle: surfaceSubtle ?? this.surfaceSubtle,
      surfaceMuted: surfaceMuted ?? this.surfaceMuted,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      border: border ?? this.border,
      borderStrong: borderStrong ?? this.borderStrong,
      brandText: brandText ?? this.brandText,
      brandStrong: brandStrong ?? this.brandStrong,
      accent: accent ?? this.accent,
      accentMid: accentMid ?? this.accentMid,
      accentSoft: accentSoft ?? this.accentSoft,
      accentSofter: accentSofter ?? this.accentSofter,
      accentFill: accentFill ?? this.accentFill,
      accentFillHover: accentFillHover ?? this.accentFillHover,
      accentFillPressed: accentFillPressed ?? this.accentFillPressed,
      onAccent: onAccent ?? this.onAccent,
      errorText: errorText ?? this.errorText,
      warningText: warningText ?? this.warningText,
      successText: successText ?? this.successText,
      cardBorder: cardBorder ?? this.cardBorder,
      shadowTint: shadowTint ?? this.shadowTint,
      shadowStrength: shadowStrength ?? this.shadowStrength,
      decorOpacityFactor: decorOpacityFactor ?? this.decorOpacityFactor,
    );
  }

  @override
  ViroPalette lerp(ViroPalette? other, double t) {
    if (other == null) return this;
    Color mix(Color a, Color b) => Color.lerp(a, b, t)!;
    double mixDouble(double a, double b) => a + (b - a) * t;
    return ViroPalette(
      brightness: t < 0.5 ? brightness : other.brightness,
      background: mix(background, other.background),
      surface: mix(surface, other.surface),
      surfaceCard: mix(surfaceCard, other.surfaceCard),
      surfaceSubtle: mix(surfaceSubtle, other.surfaceSubtle),
      surfaceMuted: mix(surfaceMuted, other.surfaceMuted),
      textPrimary: mix(textPrimary, other.textPrimary),
      textSecondary: mix(textSecondary, other.textSecondary),
      textMuted: mix(textMuted, other.textMuted),
      border: mix(border, other.border),
      borderStrong: mix(borderStrong, other.borderStrong),
      brandText: mix(brandText, other.brandText),
      brandStrong: mix(brandStrong, other.brandStrong),
      accent: mix(accent, other.accent),
      accentMid: mix(accentMid, other.accentMid),
      accentSoft: mix(accentSoft, other.accentSoft),
      accentSofter: mix(accentSofter, other.accentSofter),
      accentFill: mix(accentFill, other.accentFill),
      accentFillHover: mix(accentFillHover, other.accentFillHover),
      accentFillPressed: mix(accentFillPressed, other.accentFillPressed),
      onAccent: mix(onAccent, other.onAccent),
      errorText: mix(errorText, other.errorText),
      warningText: mix(warningText, other.warningText),
      successText: mix(successText, other.successText),
      cardBorder: mix(cardBorder, other.cardBorder),
      shadowTint: mix(shadowTint, other.shadowTint),
      shadowStrength: mixDouble(shadowStrength, other.shadowStrength),
      decorOpacityFactor:
          mixDouble(decorOpacityFactor, other.decorOpacityFactor),
    );
  }
}

/// Accès à la palette du thème courant.
extension ViroPaletteContext on BuildContext {
  /// Palette du thème courant ; [ViroPalette.light] si le thème n'en déclare
  /// pas (ex. test widget monté sur un `ThemeData` nu).
  ViroPalette get viroPalette =>
      Theme.of(this).extension<ViroPalette>() ?? ViroPalette.light;
}
