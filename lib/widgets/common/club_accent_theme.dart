import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Applique la couleur unie du club aux boutons, AppBar, FAB, inputs et dialogs.
class ClubAccentTheme extends StatelessWidget {
  const ClubAccentTheme({
    super.key,
    required this.accentColor,
    required this.child,
  });

  final Color accentColor;
  final Widget child;

  /// Style [SegmentedButton] avec la couleur unie du club.
  static ButtonStyle segmentedButtonStyle(Color accentColor, Color onAccent) {
    return ButtonStyle(
      backgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return accentColor;
        if (states.contains(WidgetState.disabled)) return ViroColors.gray100;
        return ViroColors.gray50;
      }),
      foregroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return onAccent;
        if (states.contains(WidgetState.disabled)) return ViroColors.gray400;
        return accentColor;
      }),
      side: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return const BorderSide(color: ViroColors.gray200);
        }
        return BorderSide(color: accentColor.withValues(alpha: 0.45));
      }),
    );
  }

  /// Style [FilterChip] / [ChoiceChip] cohérent avec la couleur club.
  static ChipThemeData chipThemeData(ChipThemeData base, Color accentColor, Color onAccent) {
    return base.copyWith(
      backgroundColor: ViroColors.gray50,
      selectedColor: accentColor,
      secondarySelectedColor: accentColor,
      checkmarkColor: onAccent,
      disabledColor: ViroColors.gray100,
      labelStyle: base.labelStyle?.copyWith(
        color: ViroColors.gray900,
        fontWeight: FontWeight.w600,
      ),
      secondaryLabelStyle: base.secondaryLabelStyle?.copyWith(
        color: onAccent,
        fontWeight: FontWeight.w600,
      ),
      side: WidgetStateBorderSide.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return BorderSide(color: accentColor);
        }
        if (states.contains(WidgetState.disabled)) {
          return const BorderSide(color: ViroColors.gray200);
        }
        return const BorderSide(color: ViroColors.gray200);
      }),
    );
  }

  /// Construit un [ThemeData] avec la couleur de marque club.
  static ThemeData themeData(ThemeData base, Color accentColor) {
    final onAccent = accentColor.computeLuminance() > 0.55
        ? ViroColors.gray900
        : ViroColors.white;
    final accentDark = Color.lerp(accentColor, Colors.black, 0.18)!;
    final textTheme = base.textTheme;

    return base.copyWith(
      colorScheme: base.colorScheme.copyWith(
        primary: accentColor,
        onPrimary: onAccent,
        primaryContainer: accentColor.withValues(alpha: 0.12),
        onPrimaryContainer: accentColor,
        secondary: accentDark,
        onSecondary: onAccent,
      ),
      appBarTheme: base.appBarTheme.copyWith(
        foregroundColor: accentColor,
        iconTheme: IconThemeData(color: accentColor),
        actionsIconTheme: IconThemeData(color: accentColor),
        titleTextStyle: base.appBarTheme.titleTextStyle?.copyWith(
          color: accentColor,
          fontWeight: FontWeight.w700,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: accentColor,
          foregroundColor: onAccent,
          disabledBackgroundColor: accentColor.withValues(alpha: 0.35),
          minimumSize: const Size.fromHeight(ViroSpacing.buttonHeightLarge),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
          ),
          textStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: accentColor,
          foregroundColor: onAccent,
          disabledBackgroundColor: accentColor.withValues(alpha: 0.35),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: accentColor,
          side: BorderSide(color: accentColor),
          minimumSize: const Size.fromHeight(ViroSpacing.buttonHeightLarge),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
          ),
        ),
      ),
      floatingActionButtonTheme: base.floatingActionButtonTheme.copyWith(
        backgroundColor: accentColor,
        foregroundColor: onAccent,
      ),
      progressIndicatorTheme: base.progressIndicatorTheme.copyWith(
        color: accentColor,
      ),
      inputDecorationTheme: base.inputDecorationTheme.copyWith(
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
          borderSide: BorderSide(color: accentColor, width: 2),
        ),
        floatingLabelStyle: WidgetStateTextStyle.resolveWith((states) {
          final baseStyle = base.inputDecorationTheme.floatingLabelStyle ??
              textTheme.bodyLarge!;
          if (states.contains(WidgetState.error)) {
            return baseStyle.copyWith(color: ViroColors.error);
          }
          if (states.contains(WidgetState.focused)) {
            return baseStyle.copyWith(color: accentColor);
          }
          return baseStyle.copyWith(color: ViroColors.gray600);
        }),
      ),
      chipTheme: chipThemeData(base.chipTheme, accentColor, onAccent),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: segmentedButtonStyle(accentColor, onAccent),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return accentColor;
          return Colors.transparent;
        }),
        checkColor: WidgetStateProperty.all(onAccent),
        side: BorderSide(
          color: accentColor.withValues(alpha: 0.55),
          width: 1.5,
        ),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return accentColor;
          return ViroColors.gray400;
        }),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: accentColor),
      ),
      dialogTheme: base.dialogTheme.copyWith(
        titleTextStyle: textTheme.titleLarge?.copyWith(
          color: accentColor,
          fontWeight: FontWeight.w700,
        ),
      ),
      bottomSheetTheme: base.bottomSheetTheme.copyWith(
        modalBackgroundColor: ViroColors.surfaceCard,
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(foregroundColor: accentColor),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: themeData(Theme.of(context), accentColor),
      child: child,
    );
  }
}

/// Enveloppe un builder de modal (dialog / sheet) avec le thème club.
Widget clubAccentModalBuilder({
  required BuildContext context,
  required Color accentColor,
  required WidgetBuilder builder,
}) {
  return ClubAccentTheme(
    accentColor: accentColor,
    child: Builder(builder: builder),
  );
}
