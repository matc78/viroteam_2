import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Barre fixe bas d’écran : fondu + bouton Créer / Créer la série.
///
/// Quand le bouton est désactivé, [blockingReason] dit ce qui manque juste
/// sous le CTA (ex. « Choisis une équipe »).
class AddEventSaveBar extends StatelessWidget {
  /// Affiche le CTA de création d’événement collé en bas.
  const AddEventSaveBar({
    super.key,
    required this.isRecurringSeries,
    required this.isLoading,
    required this.canSubmit,
    required this.onSubmit,
    this.blockingReason,
  });

  final bool isRecurringSeries;
  final bool isLoading;
  final bool canSubmit;
  final VoidCallback onSubmit;

  /// Raison affichée sous le bouton quand [canSubmit] est faux.
  final String? blockingReason;

  /// Hauteur d'une ligne de raison (texte + marge), réservée en plus.
  static const double _reasonLineHeight = ViroSpacing.lg;

  /// Hauteur réservée sous le ListView (fondu + bouton + safe area), plus la
  /// ligne de raison si [showsReason].
  static double reservedHeight(
    BuildContext context, {
    bool showsReason = false,
  }) {
    final bottomSafeInset = MediaQuery.paddingOf(context).bottom;
    return ViroSpacing.lg +
        ViroSpacing.sm +
        ViroSpacing.buttonHeightLarge +
        ViroSpacing.md +
        (showsReason ? _reasonLineHeight : 0) +
        bottomSafeInset;
  }

  /// Vrai si la barre affiche une raison de blocage (pour [reservedHeight]).
  static bool showsReasonFor({
    required bool isLoading,
    required bool canSubmit,
    required String? blockingReason,
  }) => !isLoading && !canSubmit && blockingReason != null;

  @override
  Widget build(BuildContext context) {
    const fadeHeight = ViroSpacing.lg;
    final palette = context.viroPalette;
    final background = palette.background;
    final reason =
        showsReasonFor(
          isLoading: isLoading,
          canSubmit: canSubmit,
          blockingReason: blockingReason,
        )
        ? blockingReason
        : null;

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
                    background.withValues(alpha: 0),
                    background,
                  ],
                ),
              ),
            ),
          ),
        ),
        ColoredBox(
          color: background,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                ViroSpacing.screenHorizontal,
                ViroSpacing.sm,
                ViroSpacing.screenHorizontal,
                ViroSpacing.md,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ViroPrimaryButton(
                    label: isRecurringSeries
                        ? AppCopy.planning.createSeries
                        : AppCopy.planning.createEvent,
                    isLoading: isLoading,
                    onPressed: isLoading || !canSubmit ? null : onSubmit,
                  ),
                  if (reason != null)
                    SizedBox(
                      height: _reasonLineHeight,
                      child: Align(
                        alignment: Alignment.bottomCenter,
                        child: Semantics(
                          liveRegion: true,
                          child: Text(
                            reason,
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: palette.textSecondary),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
