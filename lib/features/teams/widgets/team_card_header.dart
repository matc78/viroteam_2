import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/club_color.dart';

/// En-tête d'une carte d'équipe dépliable (Mes équipes, Gérer) : avatar,
/// nom, catégorie + effectif (toujours visibles) et pastille FFVB si liée.
class TeamCardHeader extends StatelessWidget {
  const TeamCardHeader({
    super.key,
    required this.team,
    required this.club,
    required this.accent,
    this.categoryColor,
  });

  final ClubTeam team;
  final Club club;
  final Color accent;

  /// Couleur de la catégorie (pastille devant le résumé), `null` = aucune.
  final Color? categoryColor;

  static const double _avatarRadius = 22;
  static const double _categoryDotSize = 8;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final accentText = palette.readableAccent(accent);
    final style = ClubAccentStyle(accent);

    final teamAvatar = team.avatarUrl?.trim();
    final clubLogo = club.logoUrl?.trim();
    final imageUrl = teamAvatar != null && teamAvatar.isNotEmpty
        ? teamAvatar
        : clubLogo != null && clubLogo.isNotEmpty
            ? clubLogo
            : null;

    final summary = [
      if (team.categoryLabel.isNotEmpty) team.categoryLabel,
      AppCopy.teams.rosterSummary(
        players: team.playerIds.length,
        coaches: team.coachIds.length,
        pending: team.pendingPlayerIds.length,
      ),
    ].join(' · ');

    return Row(
      children: [
        CircleAvatar(
          radius: _avatarRadius,
          backgroundColor: style.iconFill,
          backgroundImage: imageUrl != null ? NetworkImage(imageUrl) : null,
          child: imageUrl != null
              ? null
              : ViroIcon(ViroIcons.users, color: accentText),
        ),
        const SizedBox(width: ViroSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      team.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: accentText,
                      ),
                    ),
                  ),
                  if (team.federation != null) ...[
                    const SizedBox(width: ViroSpacing.xs),
                    _FederationBadge(accent: accent),
                  ],
                ],
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  if (categoryColor case final dotColor?) ...[
                    Container(
                      width: _categoryDotSize,
                      height: _categoryDotSize,
                      decoration: BoxDecoration(
                        color: dotColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: ViroSpacing.xs),
                  ],
                  Expanded(
                    child: Text(
                      summary,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FederationBadge extends StatelessWidget {
  const _FederationBadge({required this.accent});

  final Color accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final accentText = palette.readableAccent(accent);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.xs + 2,
        vertical: 1,
      ),
      decoration: BoxDecoration(
        color: ClubAccentStyle(accent).chipFill,
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ViroIcon(ViroIcons.trophyOutline, size: 12, color: accentText),
          const SizedBox(width: 3),
          Text(
            AppCopy.standings.federationBadge,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: accentText,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}
