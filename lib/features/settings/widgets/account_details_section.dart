import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/settings/widgets/change_email_sheet.dart';
import 'package:viro_team_v2/features/settings/widgets/change_password_sheet.dart';
import 'package:viro_team_v2/features/settings/widgets/edit_profile_sheet.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/services/account_service.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/lists/settings_list_tile.dart';

/// Carte « Compte et sécurité » : profil, e-mail, mot de passe et type de
/// connexion.
class AccountDetailsSection extends ConsumerWidget {
  const AccountDetailsSection({super.key, required this.user});

  final ViroUser user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final firebaseUser = ref.watch(authStateProvider).value;
    final passwordAccount = firebaseUser != null &&
        AccountService.userHasPasswordProvider(firebaseUser);
    final reauthWithApple =
        firebaseUser != null && AccountService.reauthUsesApple(firebaseUser);
    final providerLabels = firebaseUser != null
        ? AccountService.authProviderLabels(firebaseUser)
        : const <String>[];

    return ViroCard(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.xs,
      ),
      child: Column(
        children: [
          SettingsListTile(
            title: AppCopy.settings.editProfile,
            icon: ViroIcons.edit,
            onTap: () => showEditProfileSheet(context, user: user),
          ),
          SettingsListTile(
            title: AppCopy.settings.email,
            subtitle: user.email,
            icon: ViroIcons.envelope,
            onTap: () => showChangeEmailSheet(
              context,
              user: user,
              passwordAccount: passwordAccount,
              reauthWithApple: reauthWithApple,
            ),
          ),
          if (passwordAccount)
            SettingsListTile(
              title: AppCopy.settings.password,
              icon: ViroIcons.key,
              onTap: () => showChangePasswordSheet(context),
            ),
          SettingsListTile(
            title: AppCopy.settings.connectionType,
            subtitle: providerLabels.join(' · '),
            showDivider: false,
            trailing: const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}
