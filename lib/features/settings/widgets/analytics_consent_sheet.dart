import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/settings/providers/analytics_consent_provider.dart';
import 'package:viro_team_v2/services/analytics_consent_service.dart';
import 'package:viro_team_v2/widgets/common/viro_benefit_row.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Demande le consentement à la mesure d'audience s'il n'a jamais été donné
/// ni refusé. Retourne `true` si la feuille a été affichée (la home évite
/// alors d'enchaîner une deuxième pré-demande). Fermer sans choisir = on
/// redemandera au prochain lancement.
Future<bool> maybeShowAnalyticsConsent(
  BuildContext context,
  WidgetRef ref,
) async {
  if (ref.read(analyticsConsentProvider) != AnalyticsConsent.unknown) {
    return false;
  }
  final granted = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (sheetContext) => AnalyticsConsentSheet(
      onAccept: () => Navigator.of(sheetContext).pop(true),
      onDecline: () => Navigator.of(sheetContext).pop(false),
    ),
  );
  if (granted != null) {
    await ref.read(analyticsConsentProvider.notifier).select(granted: granted);
  }
  return true;
}

/// Contenu de la demande : ce qui est mesuré + « Accepter » / « Refuser »
/// de même poids (refuser doit être aussi simple qu'accepter).
class AnalyticsConsentSheet extends StatelessWidget {
  const AnalyticsConsentSheet({
    super.key,
    required this.onAccept,
    required this.onDecline,
  });

  final VoidCallback onAccept;
  final VoidCallback onDecline;

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
                  ViroIcons.analytics,
                  size: 32,
                  color: palette.accent,
                ),
              ),
            ),
            const SizedBox(height: ViroSpacing.md),
            Text(
              AppCopy.settings.analyticsConsentTitle,
              textAlign: TextAlign.center,
              style: theme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: palette.brandText,
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            Text(
              AppCopy.settings.analyticsConsentBody,
              textAlign: TextAlign.center,
              style: theme.bodyMedium?.copyWith(color: palette.textSecondary),
            ),
            const SizedBox(height: ViroSpacing.lg),
            ViroBenefitRow(
              icon: ViroIcons.analytics,
              label: AppCopy.settings.analyticsConsentPointUsage,
            ),
            const SizedBox(height: ViroSpacing.sm),
            ViroBenefitRow(
              icon: ViroIcons.eyeSlash,
              label: AppCopy.settings.analyticsConsentPointNoContent,
            ),
            const SizedBox(height: ViroSpacing.sm),
            ViroBenefitRow(
              icon: ViroIcons.block,
              label: AppCopy.settings.analyticsConsentPointNoAds,
            ),
            const SizedBox(height: ViroSpacing.md),
            Text(
              AppCopy.settings.analyticsConsentFooter,
              textAlign: TextAlign.center,
              style: theme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
            const SizedBox(height: ViroSpacing.md),
            ViroPrimaryButton(
              label: AppCopy.settings.analyticsConsentAccept,
              onPressed: onAccept,
            ),
            const SizedBox(height: ViroSpacing.sm),
            SizedBox(
              height: ViroSpacing.buttonHeightMedium,
              child: OutlinedButton(
                onPressed: onDecline,
                child: Text(AppCopy.settings.analyticsConsentDecline),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
