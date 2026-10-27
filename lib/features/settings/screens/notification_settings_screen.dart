import 'package:flutter/material.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/widgets/notification_preferences_section.dart';
import 'package:viro_team_v2/features/settings/widgets/settings_subpage.dart';

/// Paramètres > Notifications : préférences push.
class NotificationSettingsScreen extends StatelessWidget {
  const NotificationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SettingsSubpage(
      title: AppCopy.settings.categoryNotifications,
      userBuilder: (context, user) => [
        NotificationPreferencesSection(user: user, showTitle: false),
      ],
    );
  }
}
