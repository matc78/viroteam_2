import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Équipe proposée quand plusieurs classements sont disponibles (coupe de
/// la home).
class StandingsTeamPickerListTile extends StatelessWidget {
  const StandingsTeamPickerListTile({
    super.key,
    required this.team,
    required this.accentColor,
    required this.onTap,
  });

  final ClubTeam team;
  final Color accentColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final readable = palette.readableAccent(accentColor);
    final poolLabel = team.federation?.poolLabel;

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        onTap: onTap,
        accentColor: accentColor,
        semanticLabel: team.name,
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm + 2,
        ),
        child: Row(
          children: [
            ViroIcon(ViroIcons.trophyOutline, size: 22, color: readable),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    team.name,
                    style: theme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: palette.textPrimary,
                    ),
                  ),
                  if (poolLabel != null)
                    Text(
                      poolLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                ],
              ),
            ),
            ViroIcon(ViroIcons.chevronRight, size: 18, color: palette.textMuted),
          ],
        ),
      ),
    );
  }
}
