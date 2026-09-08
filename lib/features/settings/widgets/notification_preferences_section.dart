import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/models/notification_preferences.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Section paramètres : 3 toggles push (events / annonces / cotisations).
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
          title: const Text('Désactiver les notifications'),
          content: Text(notificationPreferenceOffWarning(key)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Annuler'),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Désactiver'),
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
      _ => current,
    };

    try {
      await ref.read(userServiceProvider).updateNotificationPreferences(
            uid: user.uid,
            preferences: next,
          );
    } catch (_) {
      if (context.mounted) {
        ViroSnackBar.show(context, 'Impossible d’enregistrer la préférence');
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
          'Notifications',
          style: theme.titleSmall?.copyWith(
            color: ViroColors.primary800,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: ViroSpacing.xs),
        Text(
          'Choisis quels rappels tu reçois sur cet appareil.',
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
                title: const Text('Événements'),
                subtitle: const Text('Rappels J-7 / J-2 et envois coaches'),
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
                title: const Text('Annonces'),
                subtitle: const Text('À la publication d’une annonce'),
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
                title: const Text('Cotisations'),
                subtitle: const Text('Rappel chaque lundi soir'),
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
