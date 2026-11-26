import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/team_federation.dart';
import 'package:viro_team_v2/services/standings/pool_team_season.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_rank_badge.dart';

/// Largeur des colonnes chiffrées du classement (en-tête et lignes).
abstract final class StandingsColumns {
  static const double rank = 34;
  static const double stat = 34;
  static const double badge = 24;
}

/// Ligne du classement d'une poule : rang en médaille (or, argent, bronze,
/// chocolat, puis couleur du club) et fond opaque teinté de la médaille sur
/// les 4 premières places ; l'équipe du club est mise en avant. Un tap
/// ouvre la saison de l'équipe. [entranceIndex] décale l'entrée en cascade
/// (aucune animation si `null`) ; [animateEntrance] à faux affiche la ligne
/// d'emblée, sans éclat de médaille (ligne reconstruite au défilement).
class TeamStandingListTile extends StatelessWidget {
  const TeamStandingListTile({
    super.key,
    required this.row,
    required this.isMyTeam,
    required this.accentColor,
    this.onTap,
    this.entranceIndex,
    this.animateEntrance = true,
  });

  final PoolStandingRow row;
  final bool isMyTeam;
  final Color accentColor;
  final VoidCallback? onTap;
  final int? entranceIndex;

  /// Joue l'entrée (cascade et éclat du podium). Faux une fois la première
  /// frame de la liste affichée.
  final bool animateEntrance;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final readable = palette.readableAccent(accentColor);
    final medalBackground = rankRowBackground(row.rank, palette);
    final medal = rankBadgeColor(row.rank, accentColor);
    final nameStyle = theme.bodyMedium?.copyWith(
      fontWeight: isMyTeam ? FontWeight.w800 : FontWeight.w600,
      color: isMyTeam ? readable : palette.textPrimary,
    );
    final statStyle = theme.bodyMedium?.copyWith(color: palette.textSecondary);

    Widget stat(String value, {bool strong = false}) => SizedBox(
      width: StandingsColumns.stat,
      child: Text(
        value,
        textAlign: TextAlign.end,
        style: strong
            ? statStyle?.copyWith(
                fontWeight: FontWeight.w800,
                color: palette.textPrimary,
              )
            : statStyle,
      ),
    );

    final tile = Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.xs),
      child: ViroCard(
        onTap: onTap,
        accentColor: isMyTeam ? accentColor : null,
        borderColor: isMyTeam
            ? accentColor.withValues(alpha: 0.55)
            : medalBackground != null
            ? medal.withValues(alpha: palette.isDark ? 0.55 : 0.4)
            : null,
        backgroundColor: medalBackground,
        elevated: isMyTeam || medalBackground != null,
        semanticLabel: AppCopy.standings.standingSemantics(
          rank: row.rank,
          name: displayPoolTeamName(row.name),
          points: row.points,
          played: row.played,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.sm,
          vertical: ViroSpacing.sm + 2,
        ),
        child: Row(
          children: [
            SizedBox(
              width: StandingsColumns.rank,
              child: Align(
                alignment: Alignment.centerLeft,
                child: row.rank > 0
                    ? ViroRankBadge(
                        rank: row.rank,
                        clubColor: accentColor,
                        size: StandingsColumns.badge,
                        shine: animateEntrance,
                      )
                    : const SizedBox.shrink(),
              ),
            ),
            Expanded(
              child: Text(
                displayPoolTeamName(row.name),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: nameStyle,
              ),
            ),
            stat('${row.points}', strong: true),
            stat('${row.played}'),
            stat('${row.won}'),
            stat('${row.lost}'),
          ],
        ),
      ),
    );

    final index = entranceIndex;
    if (index == null ||
        (MediaQuery.maybeDisableAnimationsOf(context) ?? false)) {
      return tile;
    }
    return _StaggeredEntrance(
      index: index,
      play: animateEntrance,
      child: tile,
    );
  }
}

/// Entrée en cascade : fondu + léger glissement vers le haut, décalé selon
/// [index] (plafonné). Si [play] est faux, la ligne apparaît d'emblée ; une
/// animation déjà lancée va quand même à son terme (seul le début change).
class _StaggeredEntrance extends StatelessWidget {
  const _StaggeredEntrance({
    required this.index,
    required this.play,
    required this.child,
  });

  final int index;
  final bool play;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final step = index.clamp(0, ViroMotion.standingsRowStaggerMax);
    final delay = ViroMotion.standingsRowStagger * step;
    final total = delay + ViroMotion.standingsRowEnter;
    final start = delay.inMilliseconds / total.inMilliseconds;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: play ? 0 : 1, end: 1),
      duration: total,
      curve: Interval(start, 1, curve: ViroMotion.enter),
      child: child,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, (1 - t) * ViroMotion.standingsRowOffset),
          child: child,
        ),
      ),
    );
  }
}
