import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Note collective de 1 à 5 étoiles, par demi-étoiles
/// (niveau de jeu, envie / participation).
/// Sans [onChanged], la note est affichée en lecture seule (taille réduite).
class TrainingRatingRow extends StatelessWidget {
  const TrainingRatingRow({
    super.key,
    required this.label,
    required this.value,
    this.hint,
    this.onChanged,
  });

  final String label;
  final String? hint;

  /// Note actuelle, `null` si pas encore posée.
  final double? value;
  final ValueChanged<double>? onChanged;

  bool get _readOnly => onChanged == null;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final starSize = _readOnly ? 18.0 : 30.0;
    final stars = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var star = 1; star <= TrainingRatings.max.round(); star++)
          _Star(
            starIndex: star,
            fill: _fillFor(star),
            size: starSize,
            onSelect: _readOnly
                ? null
                : (rating) {
                    ViroHaptics.selection();
                    onChanged!(rating);
                  },
          ),
      ],
    );

    if (_readOnly) {
      return Semantics(
        label: AppCopy.training.ratingSemantics(
          label,
          value ?? 0,
          TrainingRatings.max.round(),
        ),
        excludeSemantics: true,
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: theme.bodyMedium?.copyWith(color: palette.textSecondary),
              ),
            ),
            stars,
          ],
        ),
      );
    }

    return Column(
      children: [
        Text(
          label,
          textAlign: TextAlign.center,
          style: theme.titleSmall?.copyWith(
            color: palette.brandText,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (hint != null)
          Text(
            hint!,
            textAlign: TextAlign.center,
            style: theme.bodySmall?.copyWith(color: palette.textSecondary),
          ),
        const SizedBox(height: ViroSpacing.xs),
        stars,
      ],
    );
  }

  /// Remplissage de l'étoile [starIndex] (1 = pleine, 0.5 = demi, 0 = vide).
  double _fillFor(int starIndex) {
    final current = value;
    if (current == null) return 0;
    if (current >= starIndex) return 1;
    if (current >= starIndex - TrainingRatings.step) return 0.5;
    return 0;
  }
}

class _Star extends StatelessWidget {
  const _Star({
    required this.starIndex,
    required this.fill,
    required this.size,
    this.onSelect,
  });

  /// Rang de l'étoile (1…5).
  final int starIndex;

  /// 0 vide, 0.5 demi, 1 pleine.
  final double fill;
  final double size;
  final ValueChanged<double>? onSelect;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final icon = ViroIcon(
      fill >= 1
          ? ViroIcons.starFill
          : fill >= 0.5
          ? ViroIcons.starHalf
          : ViroIcons.star,
      size: size,
      color: fill > 0 ? ViroColors.sportYellow : palette.textMuted,
    );
    if (onSelect == null) {
      return Padding(padding: const EdgeInsets.all(1), child: icon);
    }

    // Moitié gauche → note N−0.5 (min 1) ; droite → N.
    final halfRating = (starIndex - TrainingRatings.step)
        .clamp(TrainingRatings.min, TrainingRatings.max)
        .toDouble();
    final fullRating = starIndex.toDouble();

    return SizedBox.square(
      dimension: ViroSpacing.minTouchTarget,
      child: Stack(
        alignment: Alignment.center,
        children: [
          IgnorePointer(child: icon),
          Row(
            children: [
              Expanded(
                child: ViroPressable(
                  onTap: () => onSelect!(halfRating),
                  label: AppCopy.training.ratingOptionSemantics(halfRating),
                  borderRadius: BorderRadius.circular(
                    ViroSpacing.minTouchTarget,
                  ),
                  child: const SizedBox.expand(),
                ),
              ),
              Expanded(
                child: ViroPressable(
                  onTap: () => onSelect!(fullRating),
                  label: AppCopy.training.ratingOptionSemantics(fullRating),
                  borderRadius: BorderRadius.circular(
                    ViroSpacing.minTouchTarget,
                  ),
                  child: const SizedBox.expand(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
