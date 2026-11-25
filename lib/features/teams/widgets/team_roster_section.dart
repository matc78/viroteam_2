import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Section d'effectif d'une carte d'équipe (Coachs, Joueurs, En attente) :
/// titre + compteur, bouton « Ajouter » optionnel, lignes de membres.
class TeamRosterSection extends StatelessWidget {
  const TeamRosterSection({
    super.key,
    required this.title,
    required this.titleColor,
    required this.children,
    this.onAdd,
    this.addTooltip,
    this.showWhenEmpty = true,
  });

  final String title;

  /// Couleur du titre (rendue lisible via `readableAccent`).
  final Color titleColor;

  /// Lignes de membres (`MemberListTile(embedded: true)`).
  final List<Widget> children;

  /// Ajout d'un membre ; `null` = pas de bouton (droits ou action en cours).
  final VoidCallback? onAdd;

  /// Libellé accessible du bouton d'ajout (ex. « Ajouter un coach »).
  final String? addTooltip;

  /// `false` : la section disparaît si vide (lecture seule).
  final bool showWhenEmpty;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty && !showWhenEmpty) return const SizedBox.shrink();

    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final color = palette.readableAccent(titleColor);

    return Padding(
      padding: const EdgeInsets.only(top: ViroSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: ViroSpacing.minTouchTarget,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    AppCopy.teams.sectionWithCount(title, children.length),
                    style: theme.labelSmall?.copyWith(
                      color: color,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.1,
                    ),
                  ),
                ),
                if (onAdd != null)
                  Tooltip(
                    message: addTooltip ?? AppCopy.common.add,
                    child: TextButton.icon(
                      onPressed: onAdd,
                      style: TextButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                        padding: const EdgeInsets.symmetric(
                          horizontal: ViroSpacing.sm,
                        ),
                      ),
                      icon: ViroIcon(ViroIcons.add, size: 16),
                      label: Text(AppCopy.teams.addShort),
                    ),
                  ),
              ],
            ),
          ),
          Divider(height: 1, color: palette.cardBorder),
          const SizedBox(height: ViroSpacing.xs),
          if (children.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: ViroSpacing.xs),
              child: Text(
                AppCopy.teams.noMembers,
                style: theme.bodySmall?.copyWith(color: palette.textSecondary),
              ),
            )
          else
            ...children,
        ],
      ),
    );
  }
}
