import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/widgets/settings_section_header.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/lists/settings_list_tile.dart';

/// Zone sensible en bas de « Compte et sécurité » : mène à l'écran dédié
/// de suppression du compte (jamais d'action directe ici).
class DangerZoneSection extends StatelessWidget {
  const DangerZoneSection({super.key});

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SettingsSectionHeader(
          title: AppCopy.settings.dangerZoneSection,
          subtitle: AppCopy.settings.dangerZoneSubtitle,
          color: palette.errorText,
        ),
        ViroCard(
          elevated: false,
          borderColor: palette.errorText.withValues(alpha: 0.4),
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.md,
            vertical: ViroSpacing.xs,
          ),
          child: SettingsListTile(
            title: AppCopy.settings.deleteMyAccount,
            subtitle: AppCopy.settings.deleteAccountSubtitle,
            icon: ViroIcons.trash,
            destructive: true,
            showDivider: false,
            onTap: () => context.push(AppRoutes.settingsDeleteAccount),
          ),
        ),
      ],
    );
  }
}
