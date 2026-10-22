import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/feature_flags.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/providers/notification_permission_provider.dart';
import 'package:viro_team_v2/features/settings/widgets/notification_permission_banner.dart';
import 'package:viro_team_v2/models/notification_preferences.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/notification_permission_service.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Section paramètres : toggles push (convocations / récap / réponses /
/// annonces / cotisations / chat).
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
    // Les réponses des coéquipiers sont un opt-in : pas d'avertissement au retrait.
    if (!enabled && key != 'rsvpTeammates') {
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
      'weeklyDigest' => current.copyWith(weeklyDigest: enabled),
      'announcements' => current.copyWith(announcements: enabled),
      'fees' => current.copyWith(fees: enabled),
      'rsvp' => current.copyWith(rsvp: enabled),
      'rsvpTeammates' => current.copyWith(rsvpTeammates: enabled),
      'chat' => current.copyWith(chat: enabled),
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
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final prefs = user.notificationPreferences;
    // Statut inconnu (chargement / erreur) : on ne grise rien.
    final permission = ref.watch(notificationPermissionProvider).value;
    final systemAllowed =
        permission == null ||
        permission == NotificationPermissionStatus.granted;

    Widget toggle({
      required String key,
      required String title,
      required String subtitle,
      required bool value,
      bool enabled = true,
    }) {
      return SwitchListTile.adaptive(
        contentPadding: EdgeInsets.zero,
        title: Text(title),
        subtitle: Text(subtitle),
        value: value,
        onChanged: !systemAllowed || !enabled
            ? null
            : (next) => _setPreference(
                  context: context,
                  ref: ref,
                  key: key,
                  enabled: next,
                ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          AppCopy.settings.notificationsSection,
          style: theme.titleSmall?.copyWith(
            color: palette.brandText,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: ViroSpacing.xs),
        Text(
          AppCopy.settings.notificationsSubtitle,
          style: theme.bodySmall?.copyWith(color: palette.textSecondary),
        ),
        const SizedBox(height: ViroSpacing.sm),
        if (!systemAllowed) ...[
          NotificationPermissionBanner(
            onAllow: () => ref
                .read(notificationPermissionProvider.notifier)
                .requestOrOpenSettings(),
          ),
          const SizedBox(height: ViroSpacing.sm),
        ],
        ViroCard(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.md,
            vertical: ViroSpacing.xs,
          ),
          child: Column(
            children: [
              toggle(
                key: 'events',
                title: AppCopy.settings.notifEvents,
                subtitle: AppCopy.settings.notifEventsSubtitle,
                value: prefs.events,
              ),
              const Divider(height: 1),
              toggle(
                key: 'weeklyDigest',
                title: AppCopy.settings.notifWeeklyDigest,
                subtitle: AppCopy.settings.notifWeeklyDigestSubtitle,
                value: prefs.events && prefs.weeklyDigest,
                // Le récap suit les convocations : rien sans elles.
                enabled: prefs.events,
              ),
              const Divider(height: 1),
              toggle(
                key: 'rsvp',
                title: AppCopy.settings.notifRsvp,
                subtitle: AppCopy.settings.notifRsvpSubtitle,
                value: prefs.rsvp,
              ),
              const Divider(height: 1),
              toggle(
                key: 'rsvpTeammates',
                title: AppCopy.settings.notifRsvpTeammates,
                subtitle: AppCopy.settings.notifRsvpTeammatesSubtitle,
                value: prefs.rsvp && prefs.rsvpTeammates,
                enabled: prefs.rsvp,
              ),
              const Divider(height: 1),
              toggle(
                key: 'announcements',
                title: AppCopy.settings.notifAnnouncements,
                subtitle: AppCopy.settings.notifAnnouncementsSubtitle,
                value: prefs.announcements,
              ),
              const Divider(height: 1),
              toggle(
                key: 'fees',
                title: AppCopy.settings.notifFees,
                subtitle: AppCopy.settings.notifFeesSubtitle,
                value: prefs.fees,
              ),
              if (FeatureFlags.chatMessagingLive) ...[
                const Divider(height: 1),
                toggle(
                  key: 'chat',
                  title: AppCopy.settings.notifChat,
                  subtitle: AppCopy.settings.notifChatSubtitle,
                  value: prefs.chat,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
