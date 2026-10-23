import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club_member.dart';

/// Ligne joueur cochable : convoqué (coché) ou retiré de l'événement.
class ConvocationPlayerListTile extends StatelessWidget {
  /// [onChanged] reçoit le nouvel état « convoqué » du joueur.
  const ConvocationPlayerListTile({
    super.key,
    required this.member,
    required this.convoked,
    required this.onChanged,
    this.enabled = true,
  });

  final ClubMember member;
  final bool convoked;
  final ValueChanged<bool> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final name = member.fullName.isNotEmpty
        ? member.fullName
        : AppCopy.planning.unnamedMember;

    return CheckboxListTile(
      value: convoked,
      onChanged: enabled ? (value) => onChanged(value ?? false) : null,
      contentPadding: EdgeInsets.zero,
      secondary: Opacity(
        opacity: convoked ? 1 : 0.5,
        child: MemberAvatar(member: member, size: 36),
      ),
      title: Text(
        name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: theme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w600,
          color: convoked ? palette.textPrimary : palette.textMuted,
        ),
      ),
      subtitle: convoked
          ? null
          : Text(
              AppCopy.planning.notConvoked,
              style: theme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
    );
  }
}
