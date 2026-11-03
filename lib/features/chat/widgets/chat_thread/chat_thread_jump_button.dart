import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/viro_floating_icon_button.dart';

/// Bouton « derniers messages » (badge = nouveaux messages arrivés en bas),
/// masqué tant que le fil est proche du bas.
class ChatThreadJumpButton extends StatelessWidget {
  const ChatThreadJumpButton({
    super.key,
    required this.isNearBottom,
    required this.newBelowCount,
    required this.onPressed,
  });

  final ValueListenable<bool> isNearBottom;
  final ValueListenable<int> newBelowCount;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: isNearBottom,
      builder: (context, nearBottom, _) {
        if (nearBottom) return const SizedBox.shrink();
        return ValueListenableBuilder<int>(
          valueListenable: newBelowCount,
          builder: (context, newCount, _) {
            final label = newCount > 0
                ? AppCopy.chat.newMessagesBelow(newCount)
                : AppCopy.chat.jumpToLatest;
            return Material(
              color: Colors.transparent,
              child: Tooltip(
                message: label,
                child: Badge(
                  isLabelVisible: newCount > 0,
                  label: Text('$newCount'),
                  child: ViroFloatingIconButton(
                    icon: ViroIcons.arrowDown,
                    tooltip: label,
                    circular: true,
                    onPressed: onPressed,
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}
