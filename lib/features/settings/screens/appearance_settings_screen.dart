import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/widgets/appearance_settings_section.dart';
import 'package:viro_team_v2/features/settings/widgets/haptics_settings_section.dart';
import 'package:viro_team_v2/features/settings/widgets/settings_subpage.dart';

/// Paramètres > Apparence : thème de l'app et vibrations.
class AppearanceSettingsScreen extends StatelessWidget {
  const AppearanceSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SettingsSubpage(
      title: AppCopy.settings.categoryAppearance,
      children: const [
        AppearanceSettingsSection(showTitle: false),
        SizedBox(height: ViroSpacing.lg),
        HapticsSettingsSection(),
      ],
    );
  }
}
