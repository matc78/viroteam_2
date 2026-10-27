import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/widgets/analytics_settings_section.dart';
import 'package:viro_team_v2/features/settings/widgets/legal_links_section.dart';
import 'package:viro_team_v2/features/settings/widgets/settings_subpage.dart';

/// Paramètres > Confidentialité : mesure d'audience et documents légaux.
class PrivacySettingsScreen extends StatelessWidget {
  const PrivacySettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SettingsSubpage(
      title: AppCopy.settings.categoryPrivacy,
      children: const [
        AnalyticsSettingsSection(),
        SizedBox(height: ViroSpacing.xl),
        LegalLinksSection(),
      ],
    );
  }
}
