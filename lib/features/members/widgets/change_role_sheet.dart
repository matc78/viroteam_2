import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';

Future<String?> showChangeRoleSheet(
  BuildContext context, {
  required ClubMember member,
  required Color accentColor,
}) {
  return showModalBottomSheet<String>(
    context: context,
    builder: (ctx) => ClubAccentTheme(
      accentColor: accentColor,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(ViroSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                AppCopy.members.roleOf(member.fullName),
                style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: Theme.of(ctx).appBarTheme.foregroundColor,
                    ),
              ),
              const SizedBox(height: ViroSpacing.md),
              ListTile(
                title: Text(AppCopy.common.rolePlayer),
                trailing: member.role == MemberRoles.player
                    ? ViroIcon(
                        ViroIcons.check,
                        color: Theme.of(ctx).colorScheme.primary,
                      )
                    : null,
                onTap: () => Navigator.pop(ctx, MemberRoles.player),
              ),
              ListTile(
                title: Text(AppCopy.common.roleCoachShort),
                trailing: member.role == MemberRoles.coach
                    ? ViroIcon(
                        ViroIcons.check,
                        color: Theme.of(ctx).colorScheme.primary,
                      )
                    : null,
                onTap: () => Navigator.pop(ctx, MemberRoles.coach),
              ),
              ListTile(
                title: Text(AppCopy.common.roleAdminFull),
                trailing: member.role == MemberRoles.admin
                    ? ViroIcon(
                        ViroIcons.check,
                        color: Theme.of(ctx).colorScheme.primary,
                      )
                    : null,
                onTap: () => Navigator.pop(ctx, MemberRoles.admin),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
