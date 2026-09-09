import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_rsvp_badge.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Ligne joueur (même base que [MemberListTile]) + badge RSVP.
class PlanningMemberRsvpRow extends StatelessWidget {
  const PlanningMemberRsvpRow({
    super.key,
    required this.member,
    required this.status,
    this.isTeamCoach = false,
  });

  final ClubMember member;
  final RsvpStatus status;

  /// `true` si le membre est sur le roster coach d'une équipe de l'événement.
  final bool isTeamCoach;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

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
                  member.fullName.isNotEmpty ? member.fullName : 'Sans nom',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: ViroColors.primary800,
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
                          'Pas encore inscrit',
                          style: theme.bodySmall?.copyWith(
                            color: ViroColors.gray600,
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: ViroSpacing.sm),
          PlanningRsvpStatusBadge(status: status),
        ],
      ),
    );
  }
}
