import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/standings/widgets/standings_section_title.dart';
import 'package:viro_team_v2/services/standings/pool_team_season.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// En-tête de la saison d'une équipe : rang, forme, stats clés, répartition
/// des scores, bilan domicile / extérieur et salles.
class PoolTeamSeasonHeader extends StatelessWidget {
  const PoolTeamSeasonHeader({
    super.key,
    required this.season,
    required this.accent,
  });

  final PoolTeamSeason season;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.standings;
    final row = season.row;
    final secondary = theme.bodySmall?.copyWith(
      color: palette.textSecondary,
    );

    final breakdown = row == null
        ? const <String>[]
        : [
            copy.breakdown('3-0', row.wins30),
            copy.breakdown('3-1', row.wins31),
            copy.breakdown('3-2', row.wins32),
            copy.breakdown('2-3', row.losses23),
            copy.breakdown('1-3', row.losses13),
            copy.breakdown('0-3', row.losses03),
          ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (row != null)
          Text(
            copy.rankLine(
              rank: row.rank,
              points: row.points,
              played: row.played,
            ),
            textAlign: TextAlign.center,
            style: theme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: palette.readableAccent(accent),
            ),
          ),
        if (season.form.isNotEmpty) ...[
          const SizedBox(height: ViroSpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(copy.form, style: secondary),
              const SizedBox(width: ViroSpacing.sm),
              for (final win in season.form) _FormChip(win: win),
            ],
          ),
        ],
        if (row != null) ...[
          const SizedBox(height: ViroSpacing.md),
          Row(
            children: [
              Expanded(
                child: ViroStatsCard(
                  label: copy.statRecord,
                  value: copy.record(won: row.won, lost: row.lost),
                  centered: true,
                ),
              ),
              const SizedBox(width: ViroSpacing.sm),
              Expanded(
                child: ViroStatsCard(
                  label: copy.statSets,
                  value: copy.scorePair(row.setsFor, row.setsAgainst),
                  centered: true,
                ),
              ),
              const SizedBox(width: ViroSpacing.sm),
              Expanded(
                child: ViroStatsCard(
                  label: copy.statPoints,
                  value: copy.scorePair(row.pointsFor, row.pointsAgainst),
                  centered: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: ViroSpacing.sm),
          Text(
            breakdown.join(' · '),
            textAlign: TextAlign.center,
            style: secondary,
          ),
        ],
        if (season.played.isNotEmpty) ...[
          const SizedBox(height: ViroSpacing.xs),
          Text(
            copy.homeAwayRecord(
              homeWon: season.homeWon,
              homeLost: season.homeLost,
              awayWon: season.awayWon,
              awayLost: season.awayLost,
            ),
            textAlign: TextAlign.center,
            style: secondary,
          ),
        ],
        StandingsSectionTitle(label: copy.venuesTitle, centered: true),
        if (season.homeVenues.isEmpty)
          StandingsSectionHint(label: copy.venuesEmpty, centered: true)
        else
          for (final venue in season.homeVenues)
            Padding(
              padding: const EdgeInsets.only(bottom: ViroSpacing.xs),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ViroIcon(
                    ViroIcons.place,
                    size: 18,
                    color: palette.readableAccent(accent),
                  ),
                  const SizedBox(width: ViroSpacing.xs),
                  Flexible(
                    child: Text(
                      displayPoolTeamName(venue),
                      textAlign: TextAlign.center,
                      style: theme.bodyMedium?.copyWith(
                        color: palette.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}

/// Pastille V / D de la forme récente.
class _FormChip extends StatelessWidget {
  const _FormChip({required this.win});

  final bool win;

  @override
  Widget build(BuildContext context) {
    final color = win ? ViroColors.success : ViroColors.error;
    final label = win ? AppCopy.standings.winShort : AppCopy.standings.lossShort;
    return Container(
      margin: const EdgeInsets.only(right: ViroSpacing.xs),
      width: 24,
      height: 24,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: ViroColors.white,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
