import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_overview_providers.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Ton d'une info de raccourci (neutre, positif ou à traiter).
enum ClubShortcutTone { neutral, success, warning }

/// Raccourci de la fiche club qui montre une info utile (« 3 événements
/// cette semaine », « À jour »…) en plus de son libellé.
class ClubShortcut {
  const ClubShortcut({
    required this.label,
    required this.icon,
    required this.info,
    required this.onTap,
    this.tone = ClubShortcutTone.neutral,
  });

  final String label;
  final IconData icon;
  final String info;
  final VoidCallback onTap;
  final ClubShortcutTone tone;
}

/// Construit les raccourcis membre à partir de [summary].
///
/// [onMyFee] `null` (pas de saison active) masque la carte cotisation ;
/// [latestAnnouncementTitle] `null` affiche « Aucune annonce en cours ».
List<ClubShortcut> buildMemberShortcuts({
  required ClubShortcutsSummary summary,
  required VoidCallback onPlanning,
  required VoidCallback onTeams,
  required VoidCallback onAnnouncements,
  VoidCallback? onMyFee,
  String? latestAnnouncementTitle,
}) {
  final weekCount = summary.weekEventCount;
  final teamNames = summary.teamNames;
  final fee = summary.fee;

  return [
    ClubShortcut(
      label: AppCopy.club.actionPlanning,
      icon: ViroIcons.calendar,
      info: weekCount == null
          ? AppCopy.club.loadingShort
          : AppCopy.club.weekEventsCount(weekCount),
      onTap: onPlanning,
    ),
    ClubShortcut(
      label: AppCopy.club.actionMyTeams,
      icon: ViroIcons.users,
      info: teamNames == null
          ? AppCopy.club.loadingShort
          : teamNames.isEmpty
              ? AppCopy.club.noTeamYet
              : AppCopy.club.teamsSummary(teamNames),
      onTap: onTeams,
    ),
    if (onMyFee != null)
      ClubShortcut(
        label: AppCopy.club.actionMyFee,
        icon: ViroIcons.payments,
        info: switch (fee?.kind) {
          null => AppCopy.club.feeNotSet,
          ClubFeeSummaryKind.upToDate => AppCopy.club.feeUpToDate,
          ClubFeeSummaryKind.due => AppCopy.club
              .feeRemaining(formatFeeAmountCents(fee!.remainingCents)),
        },
        tone: switch (fee?.kind) {
          ClubFeeSummaryKind.upToDate => ClubShortcutTone.success,
          ClubFeeSummaryKind.due => ClubShortcutTone.warning,
          null => ClubShortcutTone.neutral,
        },
        onTap: onMyFee,
      ),
    ClubShortcut(
      label: AppCopy.club.actionAnnouncements,
      icon: ViroIcons.megaphone,
      info: latestAnnouncementTitle ?? AppCopy.club.announcementsNone,
      onTap: onAnnouncements,
    ),
  ];
}

/// Grille 2 colonnes de raccourcis « vivants » de la fiche club.
class ClubShortcutsGrid extends StatelessWidget {
  const ClubShortcutsGrid({
    super.key,
    required this.shortcuts,
    required this.accentColor,
  });

  final List<ClubShortcut> shortcuts;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    if (shortcuts.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.screenHorizontal,
      ),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: ViroSpacing.sm,
          crossAxisSpacing: ViroSpacing.sm,
          mainAxisExtent: 84,
        ),
        itemCount: shortcuts.length,
        itemBuilder: (_, index) => ClubShortcutTile(
          shortcut: shortcuts[index],
          accentColor: accentColor,
        ),
      ),
    );
  }
}

/// Carte de raccourci : icône + libellé sur une ligne, info en dessous.
class ClubShortcutTile extends StatelessWidget {
  const ClubShortcutTile({
    super.key,
    required this.shortcut,
    required this.accentColor,
  });

  final ClubShortcut shortcut;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final radius = BorderRadius.circular(ViroSpacing.cardRadius);
    final style = ClubAccentStyle(accentColor);
    final iconColor = palette.readableAccent(accentColor);
    final infoColor = switch (shortcut.tone) {
      ClubShortcutTone.neutral => palette.textSecondary,
      ClubShortcutTone.success => palette.successText,
      ClubShortcutTone.warning => palette.warningText,
    };

    return ViroPressable(
      onTap: shortcut.onTap,
      borderRadius: radius,
      label: '${shortcut.label}, ${shortcut.info}',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: palette.surfaceCard,
          borderRadius: radius,
          border: Border.all(color: style.border),
          boxShadow: ViroMotion.accentBorderTileShadow(palette, style.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(ViroSpacing.md - 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: style.iconFill,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(ViroSpacing.sm - 2),
                      child: ViroIcon(shortcut.icon, size: 18, color: iconColor),
                    ),
                  ),
                  const SizedBox(width: ViroSpacing.sm),
                  Expanded(
                    child: Text(
                      shortcut.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.end,
                      style: theme.titleSmall?.copyWith(
                        color: palette.brandText,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (shortcut.tone != ClubShortcutTone.neutral) ...[
                    const SizedBox(width: ViroSpacing.xs),
                    _ToneDot(
                      color: shortcut.tone == ClubShortcutTone.success
                          ? ViroColors.success
                          : ViroColors.warning,
                    ),
                  ],
                ],
              ),
              const Spacer(),
              Text(
                shortcut.info,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.bodySmall?.copyWith(
                  color: infoColor,
                  fontWeight: shortcut.tone == ClubShortcutTone.neutral
                      ? null
                      : FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ToneDot extends StatelessWidget {
  const _ToneDot({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 8,
      height: 8,
      child: DecoratedBox(
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
    );
  }
}
