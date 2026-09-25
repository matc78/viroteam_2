import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';

/// Bouton emoji dans le sélecteur (état sélectionné si ta réaction).
class ChatReactionPickButton extends StatelessWidget {
  const ChatReactionPickButton({
    super.key,
    required this.emoji,
    required this.selected,
    required this.onTap,
  });

  final String emoji;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: selected
              ? ViroColors.primary400.withValues(alpha: 0.14)
              : Colors.transparent,
          border: Border.all(
            color: selected ? ViroColors.primary400 : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Text(emoji, style: const TextStyle(fontSize: 22)),
      ),
    );
  }
}
