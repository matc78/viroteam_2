import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/viro_assets.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';

/// Pictogramme ViroTeam (sans wordmark).
class ViroLogoMark extends StatelessWidget {
  const ViroLogoMark({super.key, this.height = 40});

  /// Hauteur d’affichage ; le PNG est carré donc la largeur suit.
  final double height;

  @override
  Widget build(BuildContext context) {
    return _ViroLogoImage(
      assetPath: ViroAssets.logoMark,
      height: height,
      width: height,
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
    return _ViroLogoImage(
      assetPath: ViroAssets.logoStacked,
      height: height,
    );
  }
}

/// Image de logo marque, teintée en blanc en mode sombre.
class _ViroLogoImage extends StatelessWidget {
  const _ViroLogoImage({
    required this.assetPath,
    required this.height,
    this.width,
  });

  final String assetPath;
  final double height;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final image = Image.asset(
      assetPath,
      height: height,
      width: width,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      semanticLabel: ProjectConfig.appName,
    );
    if (!context.viroPalette.isDark) return image;
    return ColorFiltered(
      colorFilter: const ColorFilter.mode(ViroColors.white, BlendMode.srcIn),
      child: image,
    );
  }
}
