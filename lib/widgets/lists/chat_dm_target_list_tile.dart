import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_selection.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/common/viro_selectable_row.dart';

/// Destinataire sélectionnable de la sheet « nouvelle conversation » (avatar,
/// nom, rôle) : la carte se teinte et prend un liseré d'accent quand il est
/// choisi.
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
    final member = this.member;
    final accent = ViroSelection.accentOf(context, null);
    return ViroCard(
      margin: const EdgeInsets.only(bottom: ViroSpacing.xs),
      padding: EdgeInsets.zero,
      borderColor: selected ? accent : null,
      child: ViroSelectableRow(
        selected: selected,
        onChanged: onChanged,
        title: label,
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm,
        ),
        leading: member != null ? MemberAvatar(member: member, size: 40) : null,
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: ViroRoleBadge(
            role: viroRoleFromChatSenderRole(role) ?? ViroRole.member,
            compact: true,
          ),
        ),
      ),
    );
  }
}
