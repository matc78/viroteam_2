import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/teams/utils/team_category_groups.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// En-tête repliable d’une catégorie dans la liste Gestion des équipes :
/// pastille de la couleur de catégorie, nom, nombre d’équipes et alertes
/// d’effectif (sans coach / sans joueur).
class TeamCategoryHeaderListTile extends StatelessWidget {
  const TeamCategoryHeaderListTile({
    super.key,
    required this.group,
    required this.expanded,
    required this.onToggle,
  });

  final TeamCategoryGroup group;
  final bool expanded;
  final VoidCallback onToggle;

  /// Diamètre de la pastille de couleur.
  static const double _dotSize = 10;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.teams;
    final alerts = [
      if (group.noCoachCount > 0) copy.categoryNoCoach(group.noCoachCount),
      if (group.noPlayerCount > 0) copy.categoryNoPlayer(group.noPlayerCount),
    ];

    return ViroPressable(
      onTap: onToggle,
      floating: false,
      label: copy.categoryHeaderSemantics(
        category: group.category,
        count: group.teams.length,
        alerts: alerts,
        expanded: expanded,
      ),
      borderRadius: BorderRadius.circular(ViroSpacing.sm),
      // Le libellé ci-dessus dit tout : pas de double lecture des textes.
      child: ExcludeSemantics(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.xs,
            vertical: ViroSpacing.sm,
          ),
          child: Row(
            children: [
              Container(
                width: _dotSize,
                height: _dotSize,
                decoration: BoxDecoration(
                  color: group.tone.color,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: ViroSpacing.sm),
              // Un seul texte : le nom garde toute la largeur disponible, les
              // alertes sont coupées en premier.
              Expanded(
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: group.category,
                        style: theme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: palette.textPrimary,
                        ),
                      ),
                      TextSpan(
                        text: '  ${copy.categoryTeamCount(group.teams.length)}',
                        style: theme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                      if (alerts.isNotEmpty)
                        TextSpan(
                          text: '  ${alerts.join(' · ')}',
                          style: theme.bodySmall?.copyWith(
                            color: palette.warningText,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                    ],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: ViroSpacing.sm),
              AnimatedRotation(
                turns: expanded ? 0 : -0.25,
                duration: ViroMotion.fast,
                child: ViroIcon(
                  ViroIcons.chevronDown,
                  size: 18,
                  color: palette.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
