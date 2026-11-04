import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Destinataire cochable de la sheet « nouvelle conversation » (avatar, nom, rôle).
class ChatDmTargetListTile extends StatelessWidget {
  const ChatDmTargetListTile({
    super.key,
    required this.label,
    required this.role,
    required this.selected,
    required this.onChanged,
    this.member,
  });

  final String label;

  /// Rôle club (`player` | `coach` | `admin`).
  final String role;
  final bool selected;
  final ValueChanged<bool> onChanged;
  final ClubMember? member;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final member = this.member;
    return ViroCard(
      margin: const EdgeInsets.only(bottom: ViroSpacing.xs),
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.sm,
        vertical: ViroSpacing.xs,
      ),
      child: CheckboxListTile(
        contentPadding: EdgeInsets.zero,
        value: selected,
        secondary:
            member != null ? MemberAvatar(member: member, size: 40) : null,
        title: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
            color: palette.brandText,
          ),
        ),
        subtitle: Align(
          alignment: Alignment.centerLeft,
          child: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: ViroRoleBadge(
              role: viroRoleFromMemberRole(role),
              compact: true,
            ),
          ),
        ),
        onChanged: (value) => onChanged(value == true),
      ),
    );
  }
}
