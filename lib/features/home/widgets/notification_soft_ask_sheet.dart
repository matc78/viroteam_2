import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/providers/notification_permission_provider.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/notification_permission_service.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Propose d'activer les notifs (pré-demande avant la popup système) si la
/// permission manque et que le rythme le permet
/// (`NotificationSoftAskService`). À appeler depuis la home, club actif.
Future<void> maybeShowNotificationSoftAsk(
  BuildContext context,
  WidgetRef ref,
) async {
  final softAsk = ref.read(notificationSoftAskServiceProvider);
  final NotificationPermissionStatus status;
  try {
    status = await ref.read(notificationPermissionProvider.future);
  } catch (_) {
    return;
  }
  if (!await softAsk.shouldShow(status)) return;
  if (!context.mounted) return;

  await softAsk.markShown();
  if (!context.mounted) return;
  final enabled = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (sheetContext) => NotificationSoftAskSheet(
      onEnable: () => Navigator.of(sheetContext).pop(true),
      onLater: () => Navigator.of(sheetContext).pop(false),
    ),
  );
  if (enabled != true) return;

  final result = await ref
      .read(notificationPermissionProvider.notifier)
      .requestOrOpenSettings();
  if (result == NotificationPermissionStatus.granted && context.mounted) {
    ViroSnackBar.show(context, AppCopy.notifications.softAskEnabledToast);
  }
}

/// Contenu de la pré-demande : bénéfices + « Activer » / « Plus tard ».
class NotificationSoftAskSheet extends StatelessWidget {
  const NotificationSoftAskSheet({
    super.key,
    required this.onEnable,
    required this.onLater,
  });

  final VoidCallback onEnable;
  final VoidCallback onLater;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          ViroSpacing.lg,
          ViroSpacing.lg,
          ViroSpacing.lg,
          ViroSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: palette.accentSofter,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: ViroIcon(
                  ViroIcons.bell,
                  size: 32,
                  color: palette.accent,
                ),
              ),
            ),
            const SizedBox(height: ViroSpacing.md),
            Text(
              AppCopy.notifications.softAskTitle,
              textAlign: TextAlign.center,
              style: theme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: palette.brandText,
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            Text(
              AppCopy.notifications.softAskBody,
              textAlign: TextAlign.center,
              style: theme.bodyMedium?.copyWith(color: palette.textSecondary),
            ),
            const SizedBox(height: ViroSpacing.lg),
            _BenefitRow(
              icon: ViroIcons.calendar,
              label: AppCopy.notifications.softAskBenefitEvents,
            ),
            const SizedBox(height: ViroSpacing.sm),
            _BenefitRow(
              icon: ViroIcons.clock,
              label: AppCopy.notifications.softAskBenefitChanges,
            ),
            const SizedBox(height: ViroSpacing.sm),
            _BenefitRow(
              icon: ViroIcons.megaphone,
              label: AppCopy.notifications.softAskBenefitAnnouncements,
            ),
            const SizedBox(height: ViroSpacing.lg),
            ViroPrimaryButton(
              label: AppCopy.notifications.softAskEnable,
              onPressed: onEnable,
            ),
            const SizedBox(height: ViroSpacing.xs),
            SizedBox(
              height: ViroSpacing.minTouchTarget,
              child: TextButton(
                onPressed: onLater,
                child: Text(AppCopy.notifications.softAskLater),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BenefitRow extends StatelessWidget {
  const _BenefitRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Row(
      children: [
        ViroIcon(icon, size: 20, color: palette.accent),
        const SizedBox(width: ViroSpacing.sm),
        Expanded(
          child: Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: palette.textPrimary),
          ),
        ),
      ],
    );
  }
}
