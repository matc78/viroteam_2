import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/services/app_update_service.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_logo.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Écran bloquant affiché tant que la version installée est sous la version
/// minimale exigée (redirection forcée par le routeur, retour désactivé).
class AppUpdateRequiredScreen extends StatelessWidget {
  const AppUpdateRequiredScreen({super.key});

  Future<void> _openStore(BuildContext context) async {
    final opened = await launchUrl(
      AppUpdateService.storeUrlFor(defaultTargetPlatform),
      mode: LaunchMode.externalApplication,
    );
    if (!opened && context.mounted) {
      ViroSnackBar.show(context, AppCopy.appUpdate.storeOpenFailed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return PopScope(
      canPop: false,
      child: ViroScaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(ViroSpacing.lg),
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  maxWidth: ProjectConfig.contentMaxWidth,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(
                      child: ViroLogo(height: ViroSpacing.logoHeightHero),
                    ),
                    const SizedBox(height: ViroSpacing.xl),
                    Text(
                      AppCopy.appUpdate.title,
                      textAlign: TextAlign.center,
                      style: theme.headlineSmall?.copyWith(
                        color: ViroColors.primary800,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: ViroSpacing.md),
                    Text(
                      AppCopy.appUpdate.body,
                      textAlign: TextAlign.center,
                      style: theme.bodyLarge?.copyWith(
                        color: ViroColors.gray600,
                      ),
                    ),
                    const SizedBox(height: ViroSpacing.xl),
                    ElevatedButton.icon(
                      onPressed: () => _openStore(context),
                      icon: ViroIcon(
                        ViroIcons.appUpdate,
                        size: ViroSpacing.buttonIconSize,
                      ),
                      label: Text(AppCopy.appUpdate.updateAction),
                    ),
                    const SizedBox(height: ViroSpacing.md),
                    Text(
                      AppCopy.appUpdate.currentVersion(
                        ProjectConfig.appVersionName,
                      ),
                      textAlign: TextAlign.center,
                      style: theme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
