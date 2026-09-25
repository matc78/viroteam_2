import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_motion.dart';

/// Chip de réaction sous un message (style WhatsApp).
class ChatReactionChip extends StatelessWidget {
  const ChatReactionChip({
    super.key,
    required this.emoji,
    required this.count,
    required this.mine,
  });

  final String emoji;
  final int count;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: ViroColors.white,
        border: Border.all(
          color: mine ? ViroColors.primary400 : ViroColors.gray200,
          width: mine ? 1.5 : 1,
        ),
        boxShadow: ViroMotion.floatingShadow(
          opacity: 0.12,
          blur: 10,
          y: 3,
        ),
      ),
      child: Text(
        count > 1 ? '$emoji $count' : emoji,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: ViroColors.gray600,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}
