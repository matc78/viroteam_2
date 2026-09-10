import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/notification_preferences.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Section paramètres : toggles push (events / annonces / cotisations / RSVP).
class NotificationPreferencesSection extends ConsumerWidget {
  const NotificationPreferencesSection({super.key, required this.user});

  final ViroUser user;

  Future<void> _setPreference({
    required BuildContext context,
    required WidgetRef ref,
    required String key,
    required bool enabled,
  }) async {
    final current = user.notificationPreferences;
    if (!enabled) {
      final accepted = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(AppCopy.settings.disableNotificationsTitle),
          content: Text(notificationPreferenceOffWarning(key)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: Text(AppCopy.common.cancel),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(AppCopy.settings.disableAction),
            ),
          ],
        ),
      );
      if (accepted != true) return;
    }

    final next = switch (key) {
      'events' => current.copyWith(events: enabled),
      'announcements' => current.copyWith(announcements: enabled),
      'fees' => current.copyWith(fees: enabled),
      'rsvp' => current.copyWith(rsvp: enabled),
      _ => current,
    };

    try {
      await ref.read(userServiceProvider).updateNotificationPreferences(
            uid: user.uid,
            preferences: next,
          );
    } catch (_) {
      if (context.mounted) {
        ViroSnackBar.show(context, AppCopy.settings.notifPrefSaveFailed);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context).textTheme;
    final prefs = user.notificationPreferences;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          AppCopy.settings.notificationsSection,
          style: theme.titleSmall?.copyWith(
            color: ViroColors.primary800,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: ViroSpacing.xs),
        Text(
          AppCopy.settings.notificationsSubtitle,
          style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
        ),
        const SizedBox(height: ViroSpacing.sm),
        ViroCard(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.md,
            vertical: ViroSpacing.xs,
          ),
          child: Column(
            children: [
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: Text(AppCopy.settings.notifEvents),
                subtitle: Text(AppCopy.settings.notifEventsSubtitle),
                value: prefs.events,
                onChanged: (value) => _setPreference(
                  context: context,
                  ref: ref,
                  key: 'events',
                  enabled: value,
                ),
              ),
              const Divider(height: 1),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: Text(AppCopy.settings.notifRsvp),
                subtitle: Text(AppCopy.settings.notifRsvpSubtitle),
                value: prefs.rsvp,
                onChanged: (value) => _setPreference(
                  context: context,
                  ref: ref,
                  key: 'rsvp',
                  enabled: value,
                ),
              ),
              const Divider(height: 1),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: Text(AppCopy.settings.notifAnnouncements),
                subtitle: Text(AppCopy.settings.notifAnnouncementsSubtitle),
                value: prefs.announcements,
                onChanged: (value) => _setPreference(
                  context: context,
                  ref: ref,
                  key: 'announcements',
                  enabled: value,
                ),
              ),
              const Divider(height: 1),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: Text(AppCopy.settings.notifFees),
                subtitle: Text(AppCopy.settings.notifFeesSubtitle),
                value: prefs.fees,
                onChanged: (value) => _setPreference(
                  context: context,
                  ref: ref,
                  key: 'fees',
                  enabled: value,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
