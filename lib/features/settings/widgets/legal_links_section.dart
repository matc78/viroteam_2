import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/widgets/settings_section_header.dart';
import 'package:viro_team_v2/utils/portal_links.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/lists/settings_list_tile.dart';

/// Liens vers les documents légaux publiés sur le portail.
class LegalLinksSection extends StatelessWidget {
  const LegalLinksSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SettingsSectionHeader(title: AppCopy.settings.legalSection),
        ViroCard(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.md,
            vertical: ViroSpacing.xs,
          ),
          child: Column(
            children: [
              SettingsListTile(
                title: AppCopy.settings.termsOfService,
                onTap: () => openPortalUrl(portalPageUrl('/legal/cgu')),
              ),
              SettingsListTile(
                title: AppCopy.settings.privacy,
                onTap: () => openPortalUrl(portalPageUrl('/legal/privacy')),
              ),
              SettingsListTile(
                title: AppCopy.settings.legalMentions,
                showDivider: false,
                onTap: () => openPortalUrl(portalPageUrl('/legal/mentions')),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
