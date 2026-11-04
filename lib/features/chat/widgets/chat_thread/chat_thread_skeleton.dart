import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_chat.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Bulles fantômes pendant le chargement du fil (alternance gauche / droite).
class ChatThreadSkeleton extends StatelessWidget {
  const ChatThreadSkeleton({super.key});

  /// (aligné à droite, largeur en fraction de la largeur max).
  static const _bubbles = [
    (mine: false, width: 0.55),
    (mine: false, width: 0.35),
    (mine: true, width: 0.6),
    (mine: false, width: 0.45),
    (mine: true, width: 0.3),
    (mine: true, width: 0.5),
  ];

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Semantics(
      label: AppCopy.common.loading,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final maxWidth = (constraints.maxWidth -
                  2 * ViroSpacing.screenHorizontal) *
              ViroChat.bubbleMaxWidthFraction;
          return ListView(
            reverse: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(
              horizontal: ViroSpacing.screenHorizontal,
              vertical: ViroSpacing.sm,
            ),
            children: [
              for (final bubble in _bubbles)
                Align(
                  alignment: bubble.mine
                      ? Alignment.centerRight
                      : Alignment.centerLeft,
                  child: Container(
                    width: maxWidth * bubble.width,
                    height: 36,
                    margin: const EdgeInsets.symmetric(
                      vertical: ViroChat.messageGap / 2,
                    ),
                    decoration: BoxDecoration(
                      color: bubble.mine
                          ? palette.accentSoft
                          : palette.surfaceMuted,
                      borderRadius:
                          BorderRadius.circular(ViroChat.bubbleRadius),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
