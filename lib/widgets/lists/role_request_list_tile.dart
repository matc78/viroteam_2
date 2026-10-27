import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/join_request.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Libellé court d'un rôle club (Joueur / Coach / Admin).
String memberRoleShortLabel(String role) => switch (role) {
      MemberRoles.admin => AppCopy.common.roleAdmin,
      MemberRoles.coach => AppCopy.common.roleCoachShort,
      _ => AppCopy.common.rolePlayer,
    };

/// Carte d'une demande de rôle : demandeur, rôle souhaité, message éventuel
/// et deux actions (Refuser / Accepter).
///
/// [busy] désactive les boutons pendant l'appel serveur.
class RoleRequestListTile extends StatelessWidget {
  const RoleRequestListTile({
    super.key,
    required this.request,
    required this.member,
    required this.onAccept,
    required this.onRefuse,
    this.busy = false,
    this.accentColor,
  });

  final JoinRequest request;
  final ClubMember member;
  final VoidCallback onAccept;
  final VoidCallback onRefuse;
  final bool busy;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final name = member.fullName.trim().isNotEmpty
        ? member.fullName.trim()
        : request.fullName.isNotEmpty
            ? request.fullName
            : AppCopy.club.roleRequestFallbackName;

    return ViroCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              MemberAvatar(member: member, size: 40, accentColor: accentColor),
              const SizedBox(width: ViroSpacing.sm + 4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: theme.titleSmall?.copyWith(
                        color: palette.brandText,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      AppCopy.club.roleRequestAsk(
                        memberRoleShortLabel(request.roleRequested),
                        memberRoleShortLabel(member.role),
                      ),
                      style: theme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (request.message.isNotEmpty) ...[
            const SizedBox(height: ViroSpacing.sm),
            Text(
              '« ${request.message} »',
              style: theme.bodyMedium?.copyWith(
                color: palette.textPrimary,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
          const SizedBox(height: ViroSpacing.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onRefuse,
                  child: Text(AppCopy.club.roleRequestRefuse),
                ),
              ),
              const SizedBox(width: ViroSpacing.sm),
              Expanded(
                child: ElevatedButton(
                  onPressed: busy ? null : onAccept,
                  child: busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(AppCopy.club.roleRequestAccept),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
