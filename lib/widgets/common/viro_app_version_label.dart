import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Libellé discret de la version installée (`ViroTeam X.Y.Z`).
///
/// Affiché en bas des écrans pré-login et sous la déconnexion dans les
/// paramètres, pour faciliter le diagnostic support.
class ViroAppVersionLabel extends StatelessWidget {
  const ViroAppVersionLabel({super.key});

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Text(
      AppCopy.common.appVersionLabel(ProjectConfig.appVersionName),
      textAlign: TextAlign.center,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: palette.textMuted,
          ),
    );
  }
}
