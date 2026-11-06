import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/home/models/rsvp_push_highlight.dart';
import 'package:viro_team_v2/features/home/providers/rsvp_highlight_offscreen_provider.dart';
import 'package:viro_team_v2/features/home/providers/rsvp_push_highlight_provider.dart';
import 'package:viro_team_v2/features/home/widgets/club_selector_bar.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Flèches haut / bas pendant le liseré RSVP, si un event encadré est hors
/// écran. Disparaissent avec le liseré ([ViroMotion.rsvpHighlightDuration]).
class RsvpHighlightScrollHints extends ConsumerWidget {
  const RsvpHighlightScrollHints({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final highlightActive = ref.watch(rsvpPushHighlightProvider) != null;
    if (!highlightActive) return const SizedBox.shrink();

    final hints = ref.watch(rsvpHighlightOffscreenProvider);
    if (hints.isEmpty) return const SizedBox.shrink();

    final notifier = ref.read(rsvpHighlightOffscreenProvider.notifier);
    final bottomPad =
        ClubSelectorBar.bottomClearance(context) + ViroSpacing.sm;

    return Stack(
      children: [
        if (hints.up)
          Positioned(
            top: ViroSpacing.sm,
            left: 0,
            right: 0,
            child: Center(
              child: _RsvpHighlightScrollArrow(
                side: RsvpHighlightOffscreenSide.up,
                tooltip: AppCopy.home.rsvpHighlightScrollUp,
                onTap: () => notifier.reveal(RsvpHighlightOffscreenSide.up),
              ),
            ),
          ),
        if (hints.down)
          Positioned(
            bottom: bottomPad,
            left: 0,
            right: 0,
            child: Center(
              child: _RsvpHighlightScrollArrow(
                side: RsvpHighlightOffscreenSide.down,
                tooltip: AppCopy.home.rsvpHighlightScrollDown,
                onTap: () => notifier.reveal(RsvpHighlightOffscreenSide.down),
              ),
            ),
          ),
      ],
    );
  }
}

/// Petite pastille flèche, pulsée au même rythme que le liseré RSVP.
class _RsvpHighlightScrollArrow extends StatefulWidget {
  const _RsvpHighlightScrollArrow({
    required this.side,
    required this.tooltip,
    required this.onTap,
  });

  final RsvpHighlightOffscreenSide side;
  final String tooltip;
  final VoidCallback onTap;

  @override
  State<_RsvpHighlightScrollArrow> createState() =>
      _RsvpHighlightScrollArrowState();
}

class _RsvpHighlightScrollArrowState extends State<_RsvpHighlightScrollArrow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: ViroMotion.rsvpHighlightBlink,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _pulse
        ..stop()
        ..value = 1;
    } else if (!_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final icon = widget.side == RsvpHighlightOffscreenSide.up
        ? ViroIcons.arrowUpBold
        : ViroIcons.arrowDownBold;
    // Clair : pastille bleue + flèche blanche. Sombre : pastille claire +
    // flèche bleue (contraste fort sur le fond bleu nuit).
    final Color background;
    final Color foreground;
    final List<BoxShadow> shadows;
    if (palette.isDark) {
      background = palette.brandText;
      foreground = palette.accentFill;
      shadows = [
        ...ViroMotion.floatingShadow(palette, opacity: 0.28, blur: 16, y: 4),
        ...palette.neonBoxGlow(palette.accent, blur: 18, alpha: 0.55),
      ];
    } else {
      background = palette.accentFill;
      foreground = palette.onAccent;
      shadows = ViroMotion.floatingShadow(palette, opacity: 0.22, blur: 16, y: 5);
    }

    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) {
        final t = ViroMotion.exit.transform(_pulse.value);
        // Pulse d’échelle / halo, pas de fondu : la flèche reste lisible.
        final scale = 0.92 + 0.08 * t;
        return Transform.scale(scale: scale, child: child);
      },
      child: Tooltip(
        message: widget.tooltip,
        child: ViroPressable(
          onTap: widget.onTap,
          label: widget.tooltip,
          borderRadius: BorderRadius.circular(999),
          child: Container(
            width: ViroSpacing.minTouchTarget,
            height: ViroSpacing.minTouchTarget,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: background,
              shape: BoxShape.circle,
              border: Border.all(
                color: palette.isDark ? palette.accent : palette.onAccent,
                width: palette.isDark ? 2 : 1.5,
              ),
              boxShadow: shadows,
            ),
            child: ViroIcon(
              icon,
              size: 24,
              color: foreground,
              semanticLabel: widget.tooltip,
            ),
          ),
        ),
      ),
    );
  }
}
