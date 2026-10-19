import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Bandeau « notifs coupées sur le téléphone » + bouton d'autorisation
/// (popup système si possible, sinon réglages du téléphone).
class NotificationPermissionBanner extends StatelessWidget {
  const NotificationPermissionBanner({super.key, required this.onAllow});

  final VoidCallback onAllow;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return ViroCard(
      padding: const EdgeInsets.all(ViroSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ViroIcon(ViroIcons.mute, color: ViroColors.warning),
              const SizedBox(width: ViroSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppCopy.notifications.systemDisabledTitle,
                      style: theme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: ViroColors.gray900,
                      ),
                    ),
                    const SizedBox(height: ViroSpacing.xs),
                    Text(
                      AppCopy.notifications.systemDisabledBody,
                      style: theme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: ViroSpacing.sm),
          SizedBox(
            width: double.infinity,
            height: ViroSpacing.buttonHeightMedium,
            child: OutlinedButton(
              onPressed: onAllow,
              child: Text(AppCopy.notifications.systemDisabledAction),
            ),
          ),
        ],
      ),
    );
  }
}
