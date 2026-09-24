import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/widgets/common/viro_logo.dart';

/// Loader animé : pictogramme ViroTeam + anneau de progression.
class ViroLogoLoader extends StatefulWidget {
  const ViroLogoLoader({super.key, this.size = 48});

  /// Taille totale du loader (anneau inclus).
  final double size;

  @override
  State<ViroLogoLoader> createState() => _ViroLogoLoaderState();
}

class _ViroLogoLoaderState extends State<ViroLogoLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.88, end: 1).animate(
      CurvedAnimation(parent: _pulseController, curve: ViroMotion.enter),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: size,
            height: size,
            child: const CircularProgressIndicator(
              strokeWidth: 2.5,
              color: ViroColors.primary600,
            ),
          ),
          ScaleTransition(
            scale: _pulseAnimation,
            child: ViroLogoMark(height: size * 0.52),
          ),
        ],
      ),
    );
  }
}
