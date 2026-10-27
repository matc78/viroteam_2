import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/widgets/delete_account_form.dart';
import 'package:viro_team_v2/features/settings/widgets/settings_subpage.dart';

/// Paramètres > Compte et sécurité > Supprimer mon compte.
class DeleteAccountScreen extends StatelessWidget {
  const DeleteAccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SettingsSubpage(
      title: AppCopy.settings.deleteMyAccount,
      fallbackRoute: AppRoutes.settingsAccount,
      children: const [DeleteAccountForm()],
    );
  }
}
