import 'dart:async';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Toast flottant succès / erreur, au-dessus des sheets (overlay racine).
abstract final class ViroStatusToast {
  /// Affiche un toast vert (succès) ou rouge (erreur) avec icône animée.
  static void show(
    BuildContext context, {
    required String message,
    required bool success,
    Duration duration = ProjectConfig.snackBarDuration,
  }) {
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;

    late final OverlayEntry entry;
    entry = OverlayEntry(
      builder: (overlayContext) => _ViroStatusToastBanner(
        message: message,
        success: success,
        duration: duration,
        onDismissed: () {
          entry.remove();
        },
      ),
    );
    overlay.insert(entry);
  }
}

class _ViroStatusToastBanner extends StatefulWidget {
  const _ViroStatusToastBanner({
    required this.message,
    required this.success,
    required this.duration,
    required this.onDismissed,
  });

  final String message;
  final bool success;
  final Duration duration;
  final VoidCallback onDismissed;

  @override
  State<_ViroStatusToastBanner> createState() => _ViroStatusToastBannerState();
}

class _ViroStatusToastBannerState extends State<_ViroStatusToastBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _slide;
  late final Animation<double> _fade;
  late final Animation<double> _iconScale;
  Timer? _dismissTimer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: ViroMotion.modal,
    );
    _slide = CurvedAnimation(parent: _controller, curve: ViroMotion.enter);
    _fade = CurvedAnimation(parent: _controller, curve: ViroMotion.enter);
    _iconScale = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.25, 1, curve: ViroMotion.emphasis),
    );
    _controller.forward();
    _dismissTimer = Timer(widget.duration, _dismiss);
  }

  Future<void> _dismiss() async {
    if (!mounted) return;
    await _controller.reverse();
    if (!mounted) return;
    widget.onDismissed();
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.success ? ViroColors.success : ViroColors.error;
    final icon = widget.success ? ViroIcons.checkCircle : ViroIcons.xCircle;
    final top = MediaQuery.paddingOf(context).top + ViroSpacing.md;

    return Positioned(
      top: top,
      left: ViroSpacing.lg,
      right: ViroSpacing.lg,
      child: IgnorePointer(
        child: FadeTransition(
          opacity: _fade,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, -0.35),
              end: Offset.zero,
            ).animate(_slide),
            child: Material(
              color: Colors.transparent,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
                  boxShadow: ViroMotion.floatingShadow(
                    opacity: 0.22,
                    blur: 20,
                    y: 8,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ViroSpacing.md,
                    vertical: ViroSpacing.sm + 2,
                  ),
                  child: Row(
                    children: [
                      ScaleTransition(
                        scale: _iconScale,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: ViroColors.white.withValues(alpha: 0.22),
                            shape: BoxShape.circle,
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(ViroSpacing.sm),
                            child: ViroIcon(
                              icon,
                              size: 22,
                              color: ViroColors.white,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: ViroSpacing.sm + 2),
                      Expanded(
                        child: Text(
                          widget.message,
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                color: ViroColors.white,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
