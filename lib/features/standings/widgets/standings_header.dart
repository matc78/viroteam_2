import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/team_federation.dart';
import 'package:viro_team_v2/widgets/lists/team_standing_list_tile.dart';

/// En-tête du classement : poule, date de mise à jour et titres de colonnes
/// (alignés sur [TeamStandingListTile]).
class StandingsHeader extends StatelessWidget {
  const StandingsHeader({super.key, required this.standings, required this.now});

  final PoolStandings standings;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.standings;
    final fetchedAt = standings.fetchedAt;
    final columnStyle = theme.labelSmall?.copyWith(
      color: palette.textMuted,
      fontWeight: FontWeight.w700,
    );

    Widget column(String label) => SizedBox(
      width: StandingsColumns.stat,
      child: Text(label, textAlign: TextAlign.end, style: columnStyle),
    );

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.md,
        ViroSpacing.screenHorizontal,
        ViroSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (standings.poolLabel != null)
            Text(
              standings.poolLabel!,
              textAlign: TextAlign.center,
              style: theme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: palette.brandText,
              ),
            ),
          if (fetchedAt != null)
            Text(
              copy.updatedAt(fetchedAt, now),
              textAlign: TextAlign.center,
              style: theme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
          const SizedBox(height: ViroSpacing.md),
          ExcludeSemantics(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.sm),
              child: Row(
                children: [
                  SizedBox(
                    width: StandingsColumns.rank,
                    child: Text(copy.columnRank, style: columnStyle),
                  ),
                  Expanded(child: Text(copy.columnTeam, style: columnStyle)),
                  column(copy.columnPoints),
                  column(copy.columnPlayed),
                  column(copy.columnWon),
                  column(copy.columnLost),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
