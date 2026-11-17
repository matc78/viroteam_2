import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Bouton emoji dans le sélecteur (état sélectionné si ta réaction).
///
/// Cible de [ViroSpacing.minTouchTarget], libellé « Réagir avec … » pour les
/// lecteurs d’écran (l’emoji seul est lu sans contexte).
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
    final palette = context.viroPalette;
    final label = AppCopy.chat.reactWithEmoji(emoji);
    return Tooltip(
      message: label,
      excludeFromSemantics: true,
      child: Semantics(
        button: true,
        selected: selected,
        label: label,
        onTap: onTap,
        excludeSemantics: true,
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Container(
            width: ViroSpacing.minTouchTarget,
            height: ViroSpacing.minTouchTarget,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: selected
                  ? palette.accentMid.withValues(alpha: 0.14)
                  : Colors.transparent,
              border: Border.all(
                color: selected ? palette.accentMid : Colors.transparent,
                width: 1.5,
              ),
            ),
            child: Text(emoji, style: const TextStyle(fontSize: 22)),
          ),
        ),
      ),
    );
  }
}
