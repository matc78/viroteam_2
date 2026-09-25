import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Barre fixe bas d’écran : fondu + bouton Créer / Créer la série.
class AddEventSaveBar extends StatelessWidget {
  /// Affiche le CTA de création d’événement collé en bas.
  const AddEventSaveBar({
    super.key,
    required this.isRecurringSeries,
    required this.isLoading,
    required this.canSubmit,
    required this.onSubmit,
  });

  final bool isRecurringSeries;
  final bool isLoading;
  final bool canSubmit;
  final VoidCallback onSubmit;

  /// Hauteur réservée sous le ListView (fondu + bouton + safe area).
  static double reservedHeight(BuildContext context) {
    final bottomSafeInset = MediaQuery.paddingOf(context).bottom;
    return ViroSpacing.lg +
        ViroSpacing.sm +
        ViroSpacing.buttonHeightLarge +
        ViroSpacing.md +
        bottomSafeInset;
  }

  @override
  Widget build(BuildContext context) {
    const fadeHeight = ViroSpacing.lg;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        IgnorePointer(
          child: SizedBox(
            height: fadeHeight,
            width: double.infinity,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    ViroColors.white.withValues(alpha: 0),
                    ViroColors.white,
                  ],
                ),
              ),
            ),
          ),
        ),
        ColoredBox(
          color: ViroColors.white,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                ViroSpacing.screenHorizontal,
                ViroSpacing.sm,
                ViroSpacing.screenHorizontal,
                ViroSpacing.md,
              ),
              child: ViroPrimaryButton(
                label: isRecurringSeries
                    ? AppCopy.planning.createSeries
                    : AppCopy.planning.createEvent,
                isLoading: isLoading,
                onPressed: isLoading || !canSubmit ? null : onSubmit,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
