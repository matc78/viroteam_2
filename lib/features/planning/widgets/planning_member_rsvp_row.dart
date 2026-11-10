import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_rsvp_badge.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/seen_eye.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Ligne joueur (même base que [MemberListTile]) + badge RSVP.
class PlanningMemberRsvpRow extends StatelessWidget {
  const PlanningMemberRsvpRow({
    super.key,
    required this.member,
    required this.status,
    this.lastUpdatedAt,
    this.seenAt,
    this.seenEyeDelay = Duration.zero,
    this.isTeamCoach = false,
    this.onRsvpSelected,
    this.onProfileTap,
  });

  /// `true` si la ligne affiche l'œil « vu » (fermé ou ouvert) : membre
  /// sans réponse.
  static bool showsSeenEye({
    required RsvpStatus status,
    DateTime? lastUpdatedAt,
  }) =>
      lastUpdatedAt == null && status == RsvpStatus.none;

  final ClubMember member;
  final RsvpStatus status;

  /// Dernière modification du vote RSVP, si connue.
  final DateTime? lastUpdatedAt;

  /// Première vue de l'événement sur la home ; affichée seulement sans réponse.
  final DateTime? seenAt;

  /// Attente avant l'ouverture animée de l'œil (cascade dans la liste).
  final Duration seenEyeDelay;

  /// `true` si le membre est sur le roster coach d'une équipe de l'événement.
  final bool isTeamCoach;

  /// Si non null, le badge RSVP ouvre un menu pour changer la réponse (staff).
  final ValueChanged<RsvpStatus>? onRsvpSelected;

  /// Tap sur la ligne (avatar / nom) pour ouvrir la fiche membre.
  final VoidCallback? onProfileTap;

  String get _seenLabel =>
      AppCopy.planning.seenNotAnswered(formatDayMonthAtTime(seenAt!));

  Future<void> _pickStaffRsvp(BuildContext context) async {
    final onSelected = onRsvpSelected;
    if (onSelected == null) return;
    final chosen = await showModalBottomSheet<RsvpStatus>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        final palette = sheetContext.viroPalette;
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final option in [
                (RsvpStatus.yes, ViroIcons.check, ViroColors.success),
                (RsvpStatus.maybe, ViroIcons.clock, ViroColors.warning),
                (RsvpStatus.no, ViroIcons.close, ViroColors.error),
              ])
                ListTile(
                  leading: ViroIcon(option.$2, color: option.$3),
                  title: Text(
                    switch (option.$1) {
                      RsvpStatus.yes => AppCopy.planning.rsvpPresent,
                      RsvpStatus.maybe => AppCopy.planning.rsvpMaybe,
                      RsvpStatus.no => AppCopy.planning.rsvpAbsent,
                      RsvpStatus.none => AppCopy.planning.rsvpPending,
                    },
                  ),
                  selected: status == option.$1,
                  onTap: () => Navigator.pop(sheetContext, option.$1),
                  selectedColor: palette.brandText,
                ),
            ],
          ),
        );
      },
    );
    if (chosen == null || chosen == status) return;
    ViroHaptics.confirm();
    onSelected(chosen);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final answeredAtLocal = lastUpdatedAt?.toLocal();
    final badge = PlanningRsvpStatusBadge(status: status);
    final trailing = onRsvpSelected == null
        ? badge
        : ViroPressable(
            label: AppCopy.planning.editMemberRsvpTooltip,
            onTap: () => _pickStaffRsvp(context),
            child: badge,
          );

    final memberName = member.fullName.isNotEmpty
        ? member.fullName
        : AppCopy.planning.unnamedMember;

    return ViroCard(
      margin: const EdgeInsets.only(bottom: ViroSpacing.sm),
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.sm,
      ),
      onTap: onProfileTap,
      semanticLabel: memberName,
      child: Row(
        children: [
          MemberAvatar(member: member),
          const SizedBox(width: ViroSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  memberName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: palette.brandText,
                  ),
                ),
                if (isTeamCoach || !member.hasLinkedAccount) ...[
                  const SizedBox(height: 2),
                  Wrap(
                    spacing: ViroSpacing.xs,
                    runSpacing: 2,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if (isTeamCoach)
                        const ViroRoleBadge(
                          role: ViroRole.coach,
                          compact: true,
                        ),
                      if (!member.hasLinkedAccount)
                        Text(
                          AppCopy.planning.notRegisteredYet,
                          style: theme.bodySmall?.copyWith(
                            color: palette.textSecondary,
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (answeredAtLocal != null) ...[
            const SizedBox(width: ViroSpacing.sm),
            Semantics(
              label: AppCopy.planning
                  .rsvpAnsweredAt(formatDayMonthAtTime(answeredAtLocal)),
              excludeSemantics: true,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatClockTime(answeredAtLocal),
                    style: theme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                  Text(
                    formatDayMonth(answeredAtLocal),
                    style: theme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ] else if (showsSeenEye(
            status: status,
            lastUpdatedAt: lastUpdatedAt,
          )) ...[
            const SizedBox(width: ViroSpacing.sm),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SeenEye(
                  seen: seenAt != null,
                  delay: seenEyeDelay,
                  seenDetail: seenAt == null ? null : _seenLabel,
                ),
                if (seenAt != null)
                  // Déjà lu par le lecteur d'écran via le libellé de l'œil.
                  ExcludeSemantics(
                    child: Text(
                      AppCopy.common.seen,
                      style: theme.bodySmall?.copyWith(
                        color: SeenEyeColors.softWarningOf(palette),
                      ),
                    ),
                  ),
              ],
            ),
          ],
          const SizedBox(width: ViroSpacing.sm),
          trailing,
        ],
      ),
    );
  }
}
