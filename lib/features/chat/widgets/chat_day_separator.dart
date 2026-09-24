import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Chip séparateur de jour dans un thread chat.
class ChatDaySeparator extends StatelessWidget {
  const ChatDaySeparator({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: ViroSpacing.sm),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.sm,
            vertical: 4,
          ),
          decoration: BoxDecoration(
            color: ViroColors.white.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: ViroColors.gray200),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: ViroColors.gray600,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ),
      ),
    );
  }
}

/// Séparateur one-shot « — nouveau — » à l’ouverture d’un fil avec non-lus.
class ChatUnreadSeparator extends StatelessWidget {
  const ChatUnreadSeparator({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final line = Expanded(
      child: Container(
        height: 1,
        color: ViroColors.primary200.withValues(alpha: 0.7),
      ),
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: ViroSpacing.sm),
      child: Row(
        children: [
          line,
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.sm),
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: ViroColors.primary600,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                  ),
            ),
          ),
          line,
        ],
      ),
    );
  }
}

/// Overlay plein écran pour une photo chat (pinch/zoom).
Future<void> showChatImageLightbox(
  BuildContext context, {
  required String imageUrl,
}) {
  return showDialog<void>(
    context: context,
    barrierColor: ViroColors.primary900.withValues(alpha: 0.92),
    builder: (ctx) {
      return GestureDetector(
        onTap: () => Navigator.pop(ctx),
        child: InteractiveViewer(
          minScale: 1,
          maxScale: 4,
          child: Center(
            child: Image.network(
              imageUrl,
              fit: BoxFit.contain,
            ),
          ),
        ),
      );
    },
  );
}
