import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Sections internes de l’écran « Gérer les membres ».
enum MembersScreenSection { roster, parents }

/// En-tête admin de l’écran membres : bascule Membres / Parents (segmented
/// control, distinct des filtres de rôle) + raccourci vers la gestion des
/// équipes (ligne avec chevron, car elle ouvre un autre écran).
class MembersSectionHeader extends StatelessWidget {
  const MembersSectionHeader({
    super.key,
    required this.section,
    required this.onSectionChanged,
    required this.onOpenTeams,
    this.accentColor,
  });

  final MembersScreenSection section;
  final ValueChanged<MembersScreenSection> onSectionChanged;

  /// Ouvre le hub Équipes (onglet gestion).
  final VoidCallback onOpenTeams;

  /// Couleur de l’icône du raccourci Équipes (défaut : accent palette).
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final iconColor = palette.readableAccent(accentColor ?? palette.accent);
    final teamsLabel = AppCopy.teams.manageTitle;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.md,
        ViroSpacing.screenHorizontal,
        0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SegmentedButton<MembersScreenSection>(
            showSelectedIcon: false,
            segments: [
              ButtonSegment(
                value: MembersScreenSection.roster,
                label: Text(AppCopy.members.tabMembers),
              ),
              ButtonSegment(
                value: MembersScreenSection.parents,
                label: Text(AppCopy.members.tabParents),
              ),
            ],
            selected: {section},
            onSelectionChanged: (selected) => onSectionChanged(selected.first),
          ),
          const SizedBox(height: ViroSpacing.sm),
          ViroCard(
            margin: EdgeInsets.zero,
            elevated: false,
            onTap: onOpenTeams,
            padding: const EdgeInsets.symmetric(
              horizontal: ViroSpacing.md,
              vertical: ViroSpacing.sm,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                minHeight: ViroSpacing.minTouchTarget,
              ),
              child: Row(
                children: [
                  ViroIcon(ViroIcons.groups, size: 20, color: iconColor),
                  const SizedBox(width: ViroSpacing.sm),
                  Expanded(
                    child: Text(
                      teamsLabel,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: palette.textPrimary,
                          ),
                    ),
                  ),
                  ViroIcon(
                    ViroIcons.chevronRight,
                    size: 18,
                    color: palette.textMuted,
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
