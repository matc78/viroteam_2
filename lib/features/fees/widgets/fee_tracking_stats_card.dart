import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Résumé visuel du suivi admin : taux payé, barre de progression,
/// montants encaissé / restant.
class FeeTrackingStatsCard extends StatelessWidget {
  const FeeTrackingStatsCard({
    super.key,
    required this.stats,
    this.accentColor,
  });

  final FeeStats stats;

  /// Couleur club (barre + valeurs) ; à défaut l'accent de la palette.
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final textTheme = Theme.of(context).textTheme;
    final barColor = accentColor ?? palette.accent;
    final valueColor = palette.readableAccent(barColor);
    final percent = stats.total > 0 ? (stats.paidPercent * 100).round() : 0;

    return ViroCard(
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.all(ViroSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text(
                  AppCopy.fees.statsPaidRate(percent),
                  style: textTheme.titleLarge?.copyWith(
                    color: valueColor,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                AppCopy.fees.statsPaidCount(
                  paid: stats.paid,
                  total: stats.total,
                ),
                style: textTheme.bodySmall?.copyWith(
                  color: palette.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: ViroSpacing.sm),
          Semantics(
            label: AppCopy.fees.statsProgressSemantics(percent),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(ViroSpacing.xs),
              child: LinearProgressIndicator(
                value: stats.paidPercent.clamp(0, 1).toDouble(),
                minHeight: ViroSpacing.sm,
                color: barColor,
                backgroundColor: palette.surfaceSubtle,
              ),
            ),
          ),
          const SizedBox(height: ViroSpacing.sm),
          Row(
            children: [
              Expanded(
                child: _AmountColumn(
                  label: AppCopy.fees.statsCollected,
                  value: formatFeeAmountCents(stats.collectedCents),
                  color: valueColor,
                ),
              ),
              Expanded(
                child: _AmountColumn(
                  label: AppCopy.fees.statsRemaining,
                  value: formatFeeAmountCents(stats.remainingCents),
                  color: palette.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: ViroSpacing.xs),
          Text(
            AppCopy.fees.statsBreakdown(
              exempt: stats.exempt,
              awaiting: stats.awaiting,
            ),
            style: textTheme.bodySmall?.copyWith(color: palette.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _AmountColumn extends StatelessWidget {
  const _AmountColumn({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: textTheme.bodySmall?.copyWith(
            color: context.viroPalette.textSecondary,
          ),
        ),
        Text(
          value,
          style: textTheme.titleSmall?.copyWith(
            color: color,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
