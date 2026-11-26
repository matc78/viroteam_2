import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/config/viro_standings.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/standings/widgets/standings_section_title.dart';
import 'package:viro_team_v2/services/standings/pool_team_season.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_rank_badge.dart';

/// En-tête de la saison d'une équipe : carte héro (médaille de rang,
/// points, forme), stats avec jauges pour / contre, répartition des scores
/// en pastilles, bilan domicile / extérieur et salles.
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (row != null || season.form.isNotEmpty)
          _HeroCard(season: season, accent: accent),
        if (row != null) ...[
          const SizedBox(height: ViroSpacing.sm),
          Row(
            children: [
              Expanded(
                child: _RatioStatTile(
                  label: copy.statRecord,
                  forCount: row.won,
                  againstCount: row.lost,
                  isRecord: true,
                ),
              ),
              const SizedBox(width: ViroSpacing.sm),
              Expanded(
                child: _RatioStatTile(
                  label: copy.statSets,
                  forCount: row.setsFor,
                  againstCount: row.setsAgainst,
                ),
              ),
              const SizedBox(width: ViroSpacing.sm),
              Expanded(
                child: _RatioStatTile(
                  label: copy.statPoints,
                  forCount: row.pointsFor,
                  againstCount: row.pointsAgainst,
                ),
              ),
            ],
          ),
          const SizedBox(height: ViroSpacing.sm),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: ViroStandings.breakdownSpacing,
            runSpacing: ViroStandings.breakdownSpacing,
            children: [
              _BreakdownChip(label: '3-0', count: row.wins30, win: true),
              _BreakdownChip(label: '3-1', count: row.wins31, win: true),
              _BreakdownChip(label: '3-2', count: row.wins32, win: true),
              _BreakdownChip(label: '2-3', count: row.losses23, win: false),
              _BreakdownChip(label: '1-3', count: row.losses13, win: false),
              _BreakdownChip(label: '0-3', count: row.losses03, win: false),
            ],
          ),
        ],
        if (season.played.isNotEmpty) ...[
          const SizedBox(height: ViroSpacing.sm),
          Row(
            children: [
              Expanded(
                child: _SideRecordTile(
                  isHome: true,
                  won: season.homeWon,
                  lost: season.homeLost,
                ),
              ),
              const SizedBox(width: ViroSpacing.sm),
              Expanded(
                child: _SideRecordTile(
                  isHome: false,
                  won: season.awayWon,
                  lost: season.awayLost,
                ),
              ),
            ],
          ),
        ],
        StandingsSectionTitle(label: copy.venuesTitle),
        if (season.homeVenues.isEmpty)
          StandingsSectionHint(label: copy.venuesEmpty)
        else
          ViroCard(
            elevated: false,
            margin: EdgeInsets.zero,
            padding: const EdgeInsets.symmetric(
              horizontal: ViroSpacing.md,
              vertical: ViroStandings.statTilePadding,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final (index, venue) in season.homeVenues.indexed)
                  Padding(
                    padding: EdgeInsets.only(
                      top: index == 0 ? 0 : ViroSpacing.sm,
                    ),
                    child: Row(
                      children: [
                        ViroIcon(
                          ViroIcons.place,
                          size: ViroStandings.venueIcon,
                          color: palette.readableAccent(accent),
                        ),
                        const SizedBox(width: ViroSpacing.sm),
                        Expanded(
                          child: Text(
                            displayPoolTeamName(venue),
                            style: theme.bodyMedium?.copyWith(
                              color: palette.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Carte héro : médaille de rang, points, matchs joués et forme récente,
/// sur un fond teinté de la médaille (ou de la couleur du club).
class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.season, required this.accent});

  final PoolTeamSeason season;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.standings;
    final row = season.row;
    final rank = row?.rank ?? 0;
    final tint = rank > 0 ? rankBadgeColor(rank, accent) : accent;
    final background = Color.alphaBlend(
      tint.withValues(alpha: palette.isDark ? 0.2 : 0.1),
      palette.surfaceCard,
    );

    return ViroCard(
      margin: EdgeInsets.zero,
      accentColor: tint,
      backgroundColor: background,
      borderColor: tint.withValues(alpha: palette.isDark ? 0.5 : 0.35),
      padding: const EdgeInsets.all(ViroSpacing.md),
      child: Row(
        children: [
          if (rank > 0) ...[
            ViroRankBadge(rank: rank, clubColor: accent, size: ViroStandings.heroBadge),
            const SizedBox(width: ViroSpacing.md),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (row != null) ...[
                  Text.rich(
                    TextSpan(
                      children: [
                        // Pas classée (rang 0) : pas de « 0e ».
                        if (row.rank > 0)
                          TextSpan(
                            text: '${copy.ordinal(row.rank)}  ',
                            style: theme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w900,
                              color: palette.textPrimary,
                            ),
                          ),
                        TextSpan(
                          text: '${row.points} ${copy.pointsUnit}',
                          style: theme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: palette.readableAccent(accent),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    copy.playedCount(row.played),
                    style: theme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                ],
                if (season.form.isNotEmpty) ...[
                  const SizedBox(height: ViroSpacing.sm),
                  Row(
                    children: [
                      Text(
                        copy.form,
                        style: theme.labelSmall?.copyWith(
                          color: palette.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: ViroSpacing.sm),
                      for (final win in season.form) _FormChip(win: win),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Stat « pour / contre » avec une jauge verte / rouge proportionnelle.
/// Le pour est en vert, le contre (D, sets ou points perdus) en rouge.
class _RatioStatTile extends StatelessWidget {
  const _RatioStatTile({
    required this.label,
    required this.forCount,
    required this.againstCount,
    this.isRecord = false,
  });

  final String label;
  final int forCount;
  final int againstCount;

  /// `true` pour le bilan (`3V  1D`), sinon paire `9 - 7`.
  final bool isRecord;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.standings;
    final total = forCount + againstCount;
    final forColor = total == 0 ? palette.textPrimary : palette.successText;
    final againstColor = total == 0 ? palette.textPrimary : palette.errorText;
    final baseStyle = theme.titleSmall?.copyWith(
      fontWeight: FontWeight.w800,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    final value = isRecord
        ? Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '$forCount${copy.winShort}',
                  style: TextStyle(color: forColor),
                ),
                TextSpan(
                  text: '  $againstCount${copy.lossShort}',
                  style: TextStyle(color: againstColor),
                ),
              ],
            ),
            maxLines: 1,
            style: baseStyle,
          )
        : Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '$forCount',
                  style: TextStyle(color: forColor),
                ),
                TextSpan(
                  text: ' - ',
                  style: TextStyle(color: palette.textSecondary),
                ),
                TextSpan(
                  text: '$againstCount',
                  style: TextStyle(color: againstColor),
                ),
              ],
            ),
            maxLines: 1,
            style: baseStyle,
          );
    return ViroCard(
      elevated: false,
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.fromLTRB(
        ViroStandings.statTilePadding,
        ViroStandings.statTilePadding,
        ViroStandings.statTilePadding,
        ViroSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: theme.labelSmall?.copyWith(
              color: palette.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: ViroStandings.statLabelGap),
          FittedBox(fit: BoxFit.scaleDown, child: value),
          const SizedBox(height: ViroStandings.breakdownSpacing),
          ClipRRect(
            borderRadius: BorderRadius.circular(ViroSpacing.xs),
            child: SizedBox(
              height: ViroStandings.ratioBarHeight,
              child: total == 0
                  ? ColoredBox(color: palette.surfaceMuted)
                  : Row(
                      children: [
                        if (forCount > 0)
                          Expanded(
                            flex: forCount,
                            child: const ColoredBox(color: ViroColors.success),
                          ),
                        if (forCount > 0 && againstCount > 0)
                          const SizedBox(width: ViroStandings.ratioBarGap),
                        if (againstCount > 0)
                          Expanded(
                            flex: againstCount,
                            child: const ColoredBox(color: ViroColors.error),
                          ),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Pastille de répartition des scores (« 3-0 ×1 ») : verte pour les
/// victoires, rouge pour les défaites, atténuée si aucun match.
class _BreakdownChip extends StatelessWidget {
  const _BreakdownChip({
    required this.label,
    required this.count,
    required this.win,
  });

  final String label;
  final int count;
  final bool win;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final active = count > 0;
    final color = !active
        ? palette.textMuted
        : win
        ? palette.successText
        : palette.errorText;
    final fill = !active
        ? palette.surfaceSubtle
        : (win ? ViroColors.success : ViroColors.error).withValues(
            alpha: palette.isDark ? 0.2 : 0.12,
          );
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.sm,
        vertical: ViroStandings.breakdownChipVerticalPadding,
      ),
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
      ),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '$label ',
              style: TextStyle(color: color, fontWeight: FontWeight.w800),
            ),
            TextSpan(
              text: AppCopy.standings.breakdownCount(count),
              style: TextStyle(
                color: active ? palette.accent : palette.textMuted,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        style: theme.labelSmall?.copyWith(
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );
  }
}

/// Bilan à domicile (accent) ou à l'extérieur (orange).
class _SideRecordTile extends StatelessWidget {
  const _SideRecordTile({
    required this.isHome,
    required this.won,
    required this.lost,
  });

  final bool isHome;
  final int won;
  final int lost;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.standings;
    final color = palette.readableAccent(
      isHome ? palette.accent : ViroColors.sportOrange,
    );
    return ViroCard(
      elevated: false,
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.symmetric(
        horizontal: ViroStandings.statTilePadding,
        vertical: ViroSpacing.sm,
      ),
      child: Row(
        children: [
          Container(
            width: ViroStandings.sideIconBox,
            height: ViroStandings.sideIconBox,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: palette.isDark ? 0.2 : 0.12),
              borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
            ),
            child: ViroIcon(
              isHome ? ViroIcons.homeGame : ViroIcons.awayGame,
              size: ViroStandings.sideIcon,
              color: color,
            ),
          ),
          const SizedBox(width: ViroSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isHome ? copy.homeLabel : copy.awayLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.labelSmall?.copyWith(
                    color: palette.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  copy.sideRecord(won: won, lost: lost),
                  style: theme.bodyMedium?.copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
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
    final label = win
        ? AppCopy.standings.winShort
        : AppCopy.standings.lossShort;
    return Container(
      margin: const EdgeInsets.only(right: ViroSpacing.xs),
      width: ViroStandings.formChip,
      height: ViroStandings.formChip,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.35),
            blurRadius: ViroStandings.formChipShadowBlur,
            offset: const Offset(0, ViroStandings.formChipShadowOffsetY),
          ),
        ],
      ),
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
