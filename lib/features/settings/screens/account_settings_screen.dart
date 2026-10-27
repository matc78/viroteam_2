import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/widgets/account_details_section.dart';
import 'package:viro_team_v2/features/settings/widgets/danger_zone_section.dart';
import 'package:viro_team_v2/features/settings/widgets/settings_subpage.dart';

/// Paramètres > Compte et sécurité : identité, connexion, puis zone sensible.
class AccountSettingsScreen extends StatelessWidget {
  const AccountSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SettingsSubpage(
      title: AppCopy.settings.categoryAccount,
      userBuilder: (context, user) => [
        AccountDetailsSection(user: user),
        const SizedBox(height: ViroSpacing.xl),
        const DangerZoneSection(),
      ],
    );
  }
}
