import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Barre sous l’en-tête pendant une recherche : « 2 / 5 » + précédent / suivant.
///
/// [current] compte depuis le résultat le plus récent (1 = le plus récent),
/// comme sur le portail ; [total] = 0 affiche « Aucun résultat ».
class ChatThreadSearchNavigator extends StatelessWidget {
  const ChatThreadSearchNavigator({
    super.key,
    required this.current,
    required this.total,
    required this.onPrevious,
    required this.onNext,
  });

  final int current;
  final int total;

  /// Résultat plus ancien (vers le haut du fil).
  final VoidCallback onPrevious;

  /// Résultat plus récent (vers le bas du fil).
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final hasResults = total > 0;
    final label = hasResults
        ? AppCopy.chat.searchResultPosition(current, total)
        : AppCopy.chat.searchNoResult;
    return Material(
      color: palette.surfaceCard,
      child: Padding(
        padding: const EdgeInsets.only(left: ViroSpacing.screenHorizontal),
        child: Row(
          children: [
            Expanded(
              child: Semantics(
                liveRegion: true,
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: palette.textSecondary,
                      ),
                ),
              ),
            ),
            IconButton(
              tooltip: AppCopy.chat.searchPrevious,
              onPressed: hasResults && current < total ? onPrevious : null,
              icon: ViroIcon(ViroIcons.chevronUp),
            ),
            IconButton(
              tooltip: AppCopy.chat.searchNext,
              onPressed: hasResults && current > 1 ? onNext : null,
              icon: ViroIcon(ViroIcons.chevronDown),
            ),
          ],
        ),
      ),
    );
  }
}
