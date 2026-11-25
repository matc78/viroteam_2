import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/utils/parent_status_for_member.dart';
import 'package:viro_team_v2/features/members/widgets/invite_email_button.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_invitation.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/utils/invite_message.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/common/viro_selection_mark.dart';

/// Ligne de membre (liste du club, effectifs d'équipe).
///
/// Ne connaît pas les droits du lecteur : l'écran décide quelles actions
/// passer ([onEditRights], [onInviteParent], [onRemove]) ; le menu ⋮
/// n'apparaît que si au moins l'une d'elles est fournie.
class MemberListTile extends StatelessWidget {
  const MemberListTile({
    super.key,
    required this.member,
    required this.club,
    this.onEditRights,
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
    this.displayRole,
    this.isSessionMember = false,
    this.embedded = false,
  });

  final ClubMember member;
  final Club club;

  /// Ouvre l'attribution des droits (droit Administrateur du lecteur).
  final VoidCallback? onEditRights;
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

  /// Badge affiché à la place des badges dérivés (ex. slot roster
  /// Entraîneur / Joueur d'une équipe).
  final ViroRole? displayRole;

  /// `true` pour le membre en session : nom en gras pour le repérer dans la liste.
  final bool isSessionMember;

  /// `true` dans une carte d'équipe : ligne plate (pas de carte imbriquée),
  /// avatar réduit et retrait par icône neutre.
  final bool embedded;

  static const double _embeddedAvatarSize = 36;

  bool get _hasAdminMenu =>
      showClubAdminActions &&
      (onEditRights != null || onInviteParent != null || onRemove != null);
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
    final palette = context.viroPalette;
    final rawAccent = accentColor ?? palette.accent;
    // Texte / icônes en couleur club : éclaircie si trop sombre en mode sombre.
    final accent = palette.readableAccent(rawAccent);

    final memberName = member.fullName.isNotEmpty
        ? member.fullName
        : AppCopy.members.unnamed;

    final handleTap = onTap == null
        ? null
        : () {
            if (selectionMode) ViroHaptics.selection();
            onTap!();
          };

    final row = Row(
        children: [
          MemberAvatar(
            member: member,
            accentColor: rawAccent,
            size: embedded ? _embeddedAvatarSize : 44,
          ),
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
                    fontWeight:
                        isSessionMember ? FontWeight.w800 : FontWeight.w600,
                    color: accent,
                  ),
                ),
                const SizedBox(height: 2),
                Wrap(
                  spacing: ViroSpacing.xs,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (displayRole != null)
                      ViroRoleBadge(role: displayRole!, compact: true)
                    else
                      for (final badge in member.badges)
                        ViroRoleBadge(
                          role: viroRoleFromBadge(badge),
                          compact: true,
                        ),
                    if (!member.hasLinkedAccount)
                      Text(
                        AppCopy.members.notRegisteredYet,
                        style: theme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                    if (parentLinkStatus != null &&
                        parentLinkStatus != ParentLinkStatus.none) ...[
                      ViroRoleBadge(
                        role: ViroRole.parent,
                        compact: true,
                      ),
                      Text(
                        parentLinkStatus == ParentLinkStatus.active
                            ? AppCopy.members.statusConnected
                            : AppCopy.members.statusPending,
                        style: theme.bodySmall?.copyWith(
                          color: palette.textSecondary,
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
          if (!selectionMode && embedded && onRemove != null)
            IconButton(
              icon: ViroIcon(
                ViroIcons.userMinus,
                color: palette.textMuted,
                size: 20,
              ),
              onPressed: onRemove,
              tooltip: AppCopy.members.removeFromTeam,
            ),
          if (!selectionMode &&
              !embedded &&
              !showClubAdminActions &&
              onRemove != null)
            IconButton(
              icon: ViroIcon(
                ViroIcons.clearChat,
                color: ViroColors.error,
                size: 22,
              ),
              onPressed: onRemove,
              tooltip: AppCopy.members.removeFromTeam,
            ),
          if (!selectionMode && _hasAdminMenu)
            PopupMenuButton<String>(
              tooltip: AppCopy.common.moreActions,
              icon: ViroIcon(ViroIcons.moreVertical, color: palette.textSecondary),
              onSelected: (value) {
                switch (value) {
                  case 'rights':
                    onEditRights?.call();
                  case 'parent':
                    onInviteParent?.call();
                  case 'remove':
                    onRemove?.call();
                }
              },
              itemBuilder: (_) => [
                if (onEditRights != null)
                  PopupMenuItem(
                    value: 'rights',
                    child: Text(AppCopy.permissions.manageRights),
                  ),
                if (onInviteParent != null)
                  PopupMenuItem(
                    value: 'parent',
                    child: Text(AppCopy.members.inviteParent),
                  ),
                if (onRemove != null)
                  PopupMenuItem(
                    value: 'remove',
                    child: Text(AppCopy.common.delete),
                  ),
              ],
            ),
          if (selectionMode)
            Padding(
              padding: const EdgeInsets.only(left: ViroSpacing.xs),
              child: ViroSelectionMark(value: selected, color: rawAccent),
            ),
        ],
      );

    if (embedded) {
      return ViroPressable(
        floating: false,
        enabled: handleTap != null || onLongPress != null,
        onTap: handleTap,
        onLongPress: onLongPress,
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
        label: memberName,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: ViroSpacing.xs),
          child: row,
        ),
      );
    }

    return ViroCard(
      margin: const EdgeInsets.only(bottom: ViroSpacing.sm),
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.sm,
      ),
      onTap: handleTap,
      onLongPress: onLongPress,
      borderColor: selected ? accent : null,
      semanticLabel: memberName,
      child: row,
    );
  }
}
