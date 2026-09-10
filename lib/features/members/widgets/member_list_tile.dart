import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/features/members/widgets/invite_email_button.dart';
import 'package:viro_team_v2/features/members/utils/parent_status_for_member.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_invitation.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/utils/invite_message.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

class MemberListTile extends StatelessWidget {
  const MemberListTile({
    super.key,
    required this.member,
    required this.club,
    required this.viewerRole,
    this.onChangeRole,
    this.onRemove,
    this.onInviteParent,
    this.onSendEmailInvite,
    this.onTap,
    this.onLongPress,
    this.showClubAdminActions = true,
    this.accentColor,
    this.parentLinkStatus,
    this.selectionMode = false,
    this.selected = false,
  });

  final ClubMember member;
  final Club club;
  final String viewerRole;
  final VoidCallback? onChangeRole;
  final VoidCallback? onRemove;
  final VoidCallback? onInviteParent;
  final Future<bool> Function()? onSendEmailInvite;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// `false` dans un roster d'équipe : pas de menu admin ni copie d'invitation.
  final bool showClubAdminActions;
  final Color? accentColor;
  final ParentLinkStatus? parentLinkStatus;
  final bool selectionMode;
  final bool selected;

  bool get _isAdmin => viewerRole == MemberRoles.admin;
  bool get _canEmailInvite =>
      showClubAdminActions &&
      member.canReceiveInviteEmail &&
      onSendEmailInvite != null;

  bool get _canCopyInvite =>
      showClubAdminActions &&
      member.hasPendingInvite &&
      !member.hasLinkedAccount;

  Future<void> _copyInvite(BuildContext context) async {
    if (member.pendingInviteCode == null) return;
    final invitation = ClubInvitation(
      id: member.activeInvitationId ?? '',
      clubId: club.id,
      code: member.pendingInviteCode!,
      role: member.role,
      status: InvitationStatus.pending,
      memberId: member.memberId,
      expiresAt: member.pendingInviteExpiresAt,
      clubName: club.name,
    );
    final message = buildInviteMessage(club: club, invitation: invitation);
    await Clipboard.setData(ClipboardData(text: message));
    if (context.mounted) {
      ViroSnackBar.show(context, AppCopy.members.messageCopied);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final accent = accentColor ?? ViroColors.primary600;

    return ViroCard(
      margin: const EdgeInsets.only(bottom: ViroSpacing.sm),
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.sm,
      ),
      onTap: onTap,
      onLongPress: onLongPress,
      borderColor: selected ? accent : null,
      child: Row(
        children: [
          MemberAvatar(member: member, accentColor: accent),
          const SizedBox(width: ViroSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  member.fullName.isNotEmpty
                      ? member.fullName
                      : AppCopy.members.unnamed,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: accent,
                  ),
                ),
                const SizedBox(height: 2),
                Wrap(
                  spacing: ViroSpacing.xs,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    ViroRoleBadge(
                      role: viroRoleFromMemberRole(member.role),
                      compact: true,
                    ),
                    if (!member.hasLinkedAccount)
                      Text(
                        AppCopy.members.notRegisteredYet,
                        style: theme.bodySmall?.copyWith(
                          color: ViroColors.gray600,
                        ),
                      ),
                    if (parentLinkStatus != null &&
                        parentLinkStatus != ParentLinkStatus.none &&
                        member.role == MemberRoles.player) ...[
                      ViroRoleBadge(
                        role: ViroRole.parent,
                        compact: true,
                      ),
                      Text(
                        parentLinkStatus == ParentLinkStatus.active
                            ? AppCopy.members.statusConnected
                            : AppCopy.members.statusPending,
                        style: theme.bodySmall?.copyWith(
                          color: ViroColors.gray600,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          if (!selectionMode && _canEmailInvite)
            InviteEmailButton(
              variant: InviteEmailButtonVariant.ghost,
              onSend: onSendEmailInvite!,
            ),
          if (!selectionMode && _canCopyInvite && !_canEmailInvite)
            IconButton(
              icon: ViroIcon(ViroIcons.copy, color: accent),
              tooltip: AppCopy.members.copyInviteCodeTooltip,
              onPressed: () => _copyInvite(context),
            ),
          if (!selectionMode && !showClubAdminActions && onRemove != null)
            IconButton(
              icon: Icon(
                Icons.remove_circle_outline,
                color: ViroColors.error,
                size: 22,
              ),
              onPressed: onRemove,
              tooltip: AppCopy.members.removeFromTeam,
            ),
          if (!selectionMode &&
              showClubAdminActions &&
              _isAdmin &&
              member.role != MemberRoles.admin)
            PopupMenuButton<String>(
              icon: ViroIcon(ViroIcons.moreVertical, color: ViroColors.gray600),
              onSelected: (value) {
                switch (value) {
                  case 'role':
                    onChangeRole?.call();
                  case 'parent':
                    onInviteParent?.call();
                  case 'remove':
                    onRemove?.call();
                }
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: 'role',
                  child: Text(AppCopy.members.changeRole),
                ),
                if (onInviteParent != null)
                  PopupMenuItem(
                    value: 'parent',
                    child: Text(AppCopy.members.inviteParent),
                  ),
                PopupMenuItem(
                  value: 'remove',
                  child: Text(AppCopy.common.delete),
                ),
              ],
            ),
          if (selectionMode)
            Padding(
              padding: const EdgeInsets.only(left: ViroSpacing.xs),
              child: ViroIcon(
                selected ? ViroIcons.checkCircle : ViroIcons.selectAll,
                color: selected ? accent : ViroColors.gray400,
              ),
            ),
        ],
      ),
    );
  }
}
