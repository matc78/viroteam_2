import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Ligne votant dans le détail d’un sondage (avatar + nom + rôle).
class PollVoterListTile extends StatelessWidget {
  const PollVoterListTile({
    super.key,
    required this.displayName,
    this.member,
  });

  final String displayName;
  final ClubMember? member;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.screenHorizontal,
        vertical: ViroSpacing.sm,
      ),
      child: Row(
        children: [
          if (member != null)
            MemberAvatar(member: member!, size: 40)
          else
            CircleAvatar(
              radius: 20,
              backgroundColor: ViroColors.primary100,
              child: Text(
                displayName.isNotEmpty
                    ? displayName.substring(0, 1).toUpperCase()
                    : '?',
                style: theme.titleSmall?.copyWith(
                  color: ViroColors.primary600,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          const SizedBox(width: ViroSpacing.md),
          Expanded(
            child: Text(
              displayName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.bodyLarge?.copyWith(
                color: ViroColors.primary800,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          if (member != null)
            ViroRoleBadge(
              role: viroRoleFromMemberRole(member!.role),
              compact: true,
            ),
        ],
      ),
    );
  }
}
