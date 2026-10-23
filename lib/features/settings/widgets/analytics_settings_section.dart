import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/providers/analytics_consent_provider.dart';
import 'package:viro_team_v2/services/analytics_consent_service.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Section paramètres : consentement à la mesure d'audience (PostHog).
class AnalyticsSettingsSection extends ConsumerWidget {
  const AnalyticsSettingsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final granted =
        ref.watch(analyticsConsentProvider) == AnalyticsConsent.granted;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          AppCopy.settings.analyticsSection,
          style: theme.titleSmall?.copyWith(
            color: palette.brandText,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: ViroSpacing.xs),
        Text(
          AppCopy.settings.analyticsSubtitle,
          style: theme.bodySmall?.copyWith(color: palette.textSecondary),
        ),
        const SizedBox(height: ViroSpacing.sm),
        ViroCard(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.md,
            vertical: ViroSpacing.xs,
          ),
          child: SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: Text(AppCopy.settings.analyticsToggle),
            subtitle: Text(AppCopy.settings.analyticsToggleSubtitle),
            value: granted,
            onChanged: (next) => ref
                .read(analyticsConsentProvider.notifier)
                .select(granted: next),
          ),
        ),
      ],
    );
  }
}
