import 'package:flutter/material.dart';
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

  String get _seenLabel =>
      AppCopy.planning.seenNotAnswered(formatDayMonthAtTime(seenAt!));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final answeredAtLocal = lastUpdatedAt?.toLocal();

    return ViroCard(
      margin: const EdgeInsets.only(bottom: ViroSpacing.sm),
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.sm,
      ),
      child: Row(
        children: [
          MemberAvatar(member: member),
          const SizedBox(width: ViroSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  member.fullName.isNotEmpty
                      ? member.fullName
                      : AppCopy.planning.unnamedMember,
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
          PlanningRsvpStatusBadge(status: status),
        ],
      ),
    );
  }
}
