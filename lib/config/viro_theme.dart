import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_typography.dart';

export 'package:viro_team_v2/config/viro_colors.dart';
export 'package:viro_team_v2/config/viro_motion.dart';
export 'package:viro_team_v2/config/viro_palette.dart';
export 'package:viro_team_v2/config/viro_spacing.dart';
export 'package:viro_team_v2/config/viro_typography.dart';
export 'package:viro_team_v2/config/viro_icons.dart';

/// Thème Material 3 — design system ViroTeam v2 (modes clair et sombre).
abstract final class ViroTheme {
  /// Thème clair (fond blanc).
  static ThemeData get light => _build(ViroPalette.light);

  /// Thème sombre (fond bleu nuit).
  static ThemeData get dark => _build(ViroPalette.dark);

  static ThemeData _build(ViroPalette palette) {
    final colorScheme = ColorScheme(
      brightness: palette.brightness,
      primary: palette.accentFill,
      onPrimary: palette.onAccent,
      primaryContainer: palette.accentSofter,
      onPrimaryContainer: palette.brandText,
      secondary: palette.brandText,
      onSecondary: palette.background,
      surface: palette.surfaceCard,
      onSurface: palette.textPrimary,
      onSurfaceVariant: palette.textSecondary,
      surfaceContainerHighest: palette.surfaceMuted,
      error: ViroColors.error,
      onError: ViroColors.white,
      outline: palette.borderStrong,
      outlineVariant: palette.border,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: palette.brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: palette.background,
      dividerColor: palette.border,
      splashFactory: NoSplash.splashFactory,
      highlightColor: Colors.transparent,
      hoverColor: palette.accentSoft.withValues(alpha: 0.35),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.macOS: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
        },
      ),
    );

    final textTheme = ViroTypography.textTheme(base.textTheme, palette);

    return base.copyWith(
      extensions: [palette],
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        toolbarHeight: ViroSpacing.topBarHeight,
        backgroundColor: Colors.transparent,
        foregroundColor: palette.brandText,
        surfaceTintColor: Colors.transparent,
        systemOverlayStyle: palette.isDark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
        titleTextStyle: textTheme.titleMedium?.copyWith(color: palette.brandText),
        iconTheme: IconThemeData(color: palette.accent),
        shadowColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        color: palette.surfaceCard,
        elevation: 0,
        margin: const EdgeInsets.only(bottom: ViroSpacing.md),
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        ),
        shadowColor: palette.shadowTint.withValues(alpha: 0.12),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: _primaryButtonStyle(textTheme, palette),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: _secondaryButtonStyle(textTheme, palette),
      ),
      textButtonTheme: TextButtonThemeData(
        style: _tertiaryButtonStyle(textTheme, palette),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: palette.surfaceCard,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: 12,
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(
          fontStyle: FontStyle.italic,
          color: palette.textMuted,
        ),
        labelStyle: textTheme.labelLarge,
        helperStyle: textTheme.bodySmall,
        errorStyle: textTheme.bodySmall?.copyWith(color: palette.errorText),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
          borderSide: BorderSide(color: palette.borderStrong),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
          borderSide: BorderSide(color: palette.accent, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
          borderSide: const BorderSide(color: ViroColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
          borderSide: const BorderSide(color: ViroColors.error, width: 2),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: palette.surfaceSubtle,
        selectedColor: palette.accentFill,
        side: BorderSide(color: palette.border),
        labelStyle: textTheme.bodySmall?.copyWith(
          fontWeight: FontWeight.w500,
          color: palette.brandText,
        ),
        secondaryLabelStyle: textTheme.bodySmall?.copyWith(
          fontWeight: FontWeight.w600,
          color: palette.onAccent,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
        ),
        // Durée appliquée via [ViroSnackBar.show] et [ProjectConfig.snackBarDuration].
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: palette.accent,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        elevation: ViroMotion.elevationFab,
        highlightElevation: ViroMotion.elevationFab + 4,
        backgroundColor: palette.accentFill,
        foregroundColor: palette.onAccent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        sizeConstraints: const BoxConstraints.tightFor(
          width: 56,
          height: 56,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size.square(ViroSpacing.minTouchTarget),
          foregroundColor: palette.brandText,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
          ),
        ),
      ),
      popupMenuTheme: PopupMenuThemeData(
        elevation: ViroMotion.elevationMenu,
        color: palette.surfaceCard,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
          side: BorderSide(color: palette.border),
        ),
        textStyle: textTheme.bodyLarge,
      ),
      menuTheme: MenuThemeData(
        style: MenuStyle(
          elevation: WidgetStateProperty.all(ViroMotion.elevationMenu),
          backgroundColor: WidgetStateProperty.all(palette.surfaceCard),
          surfaceTintColor: WidgetStateProperty.all(Colors.transparent),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
              side: BorderSide(color: palette.border),
            ),
          ),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        elevation: ViroMotion.elevationMenu,
        backgroundColor: palette.surfaceCard,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: palette.borderStrong,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(ViroSpacing.cardRadius + 4),
          ),
        ),
      ),
      dialogTheme: DialogThemeData(
        elevation: ViroMotion.elevationMenu,
        backgroundColor: palette.surfaceCard,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        ),
        titleTextStyle: textTheme.headlineMedium,
        contentTextStyle: textTheme.bodyLarge,
      ),
      listTileTheme: ListTileThemeData(
        // Pas de tileColor opaque : sinon Flutter assert si un DecoratedBox
        // coloré s’intercale avant le Material (ink / fond masqués).
        minVerticalPadding: ViroSpacing.sm,
        contentPadding: const EdgeInsets.symmetric(horizontal: ViroSpacing.md),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
        ),
      ),
    );
  }

  static ButtonStyle _primaryButtonStyle(
    TextTheme textTheme,
    ViroPalette palette,
  ) {
    return ElevatedButton.styleFrom(
      minimumSize: const Size.fromHeight(ViroSpacing.buttonHeightLarge),
      backgroundColor: palette.accentFill,
      foregroundColor: palette.onAccent,
      disabledBackgroundColor: palette.border,
      disabledForegroundColor: palette.textMuted,
      elevation: ViroMotion.elevationRest,
      shadowColor: palette.shadowTint.withValues(alpha: 0.2),
      textStyle: textTheme.bodyLarge?.copyWith(
        fontWeight: FontWeight.w600,
        color: palette.onAccent,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
      ),
    ).copyWith(
      elevation: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) return 0;
        if (states.contains(WidgetState.pressed)) return ViroMotion.elevationPressed;
        if (states.contains(WidgetState.hovered)) return ViroMotion.elevationHover;
        return ViroMotion.elevationRest;
      }),
      overlayColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.pressed)) {
          return palette.accentFillPressed.withValues(alpha: 0.2);
        }
        if (states.contains(WidgetState.hovered)) {
          return palette.accentFill.withValues(alpha: 0.12);
        }
        return null;
      }),
      backgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) return palette.border;
        if (states.contains(WidgetState.pressed)) return palette.accentFillPressed;
        if (states.contains(WidgetState.hovered)) return palette.accentFillHover;
        return palette.accentFill;
      }),
    );
  }

  static ButtonStyle _secondaryButtonStyle(
    TextTheme textTheme,
    ViroPalette palette,
  ) {
    return OutlinedButton.styleFrom(
      minimumSize: const Size.fromHeight(ViroSpacing.buttonHeightMedium),
      foregroundColor: palette.accent,
      disabledForegroundColor: palette.textMuted,
      elevation: ViroMotion.elevationRest,
      shadowColor: palette.shadowTint.withValues(alpha: 0.1),
      side: BorderSide(color: palette.accent, width: 2),
      textStyle: textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
      ),
    ).copyWith(
      elevation: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) return 0;
        if (states.contains(WidgetState.pressed)) return ViroMotion.elevationPressed;
        if (states.contains(WidgetState.hovered)) return ViroMotion.elevationHover;
        return ViroMotion.elevationRest;
      }),
      side: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return BorderSide(color: palette.borderStrong, width: 2);
        }
        return BorderSide(color: palette.accent, width: 2);
      }),
      backgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.pressed)) return palette.accentSoft;
        if (states.contains(WidgetState.hovered)) return palette.accentSofter;
        return palette.surfaceCard;
      }),
      foregroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) return palette.textMuted;
        if (states.contains(WidgetState.pressed)) return palette.brandStrong;
        if (states.contains(WidgetState.hovered)) return palette.brandText;
        return palette.accent;
      }),
    );
  }

  static ButtonStyle _tertiaryButtonStyle(
    TextTheme textTheme,
    ViroPalette palette,
  ) {
    return TextButton.styleFrom(
      minimumSize: const Size(0, ViroSpacing.buttonHeightSmall),
      foregroundColor: palette.accent,
      disabledForegroundColor: palette.textMuted,
      textStyle: textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
    );
  }
}
