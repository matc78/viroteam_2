import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/viro_assets.dart';

/// Pictogramme ViroTeam (sans wordmark).
class ViroLogoMark extends StatelessWidget {
  const ViroLogoMark({super.key, this.height = 40});

  /// Hauteur d’affichage ; le PNG est carré donc la largeur suit.
  final double height;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      ViroAssets.logoMark,
      height: height,
      width: height,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      semanticLabel: ProjectConfig.appName,
    );
  }
}

/// Logo empilé : pictogramme + nom.
class ViroLogo extends StatelessWidget {
  const ViroLogo({super.key, this.height = 96});

  /// Hauteur d’affichage du PNG empilé.
  final double height;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      ViroAssets.logoStacked,
      height: height,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      semanticLabel: ProjectConfig.appName,
    );
  }
}
