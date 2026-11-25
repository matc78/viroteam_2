import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/team_federation.dart';
import 'package:viro_team_v2/services/standings/pool_team_season.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Largeur des colonnes chiffrées du classement (en-tête et lignes).
abstract final class StandingsColumns {
  static const double rank = 28;
  static const double stat = 34;
}

/// Ligne du classement d'une poule ; l'équipe du club est mise en avant.
/// Un tap ouvre la saison de l'équipe.
class TeamStandingListTile extends StatelessWidget {
  const TeamStandingListTile({
    super.key,
    required this.row,
    required this.isMyTeam,
    required this.accentColor,
    this.onTap,
  });

  final PoolStandingRow row;
  final bool isMyTeam;
  final Color accentColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final readable = palette.readableAccent(accentColor);
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

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.xs),
      child: ViroCard(
        onTap: onTap,
        accentColor: isMyTeam ? accentColor : null,
        borderColor: isMyTeam ? accentColor.withValues(alpha: 0.55) : null,
        elevated: isMyTeam,
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
              child: Text(
                '${row.rank}',
                style: theme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: isMyTeam ? readable : palette.textMuted,
                ),
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
  }
}
