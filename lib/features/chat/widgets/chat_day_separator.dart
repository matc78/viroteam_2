import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/widgets/common/viro_image_lightbox.dart';

/// Chip séparateur de jour dans un thread chat.
class ChatDaySeparator extends StatelessWidget {
  const ChatDaySeparator({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: ViroSpacing.sm),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.sm,
            vertical: 4,
          ),
          decoration: BoxDecoration(
            color: palette.surfaceCard.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: palette.border),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: palette.textSecondary,
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
    final palette = context.viroPalette;
    final line = Expanded(
      child: Container(
        height: 1,
        color: palette.accentMid.withValues(alpha: 0.7),
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
                    color: palette.accent,
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
  return showViroImageLightbox(
    context,
    imageUrl: imageUrl,
    shape: ViroImageLightboxShape.free,
  );
}
