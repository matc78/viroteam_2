import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/app_update_service.dart';

/// `true` quand la version installée est sous la version minimale exigée
/// pour la plateforme courante (`app_config/mobile`). Écouté par le routeur,
/// qui bascule alors sur l'écran de mise à jour obligatoire.
final appUpdateRequiredProvider = StreamProvider<bool>((ref) {
  if (kIsWeb) return Stream.value(false);
  return ref
      .watch(appUpdateServiceProvider)
      .watchMinimumVersion(defaultTargetPlatform)
      .map(
        (minimumVersion) => AppUpdateService.isUpdateRequired(
          currentVersion: ProjectConfig.appVersionName,
          minimumVersion: minimumVersion,
        ),
      );
});
