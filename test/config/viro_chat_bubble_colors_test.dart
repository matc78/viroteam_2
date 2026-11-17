import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_chat.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';

void main() {
  const club = Color(0xFFE53935);

  test('clair : mes bulles bleu marque opaque, les autres blanches, sans '
      'contour', () {
    final mine = ViroChat.bubbleColors(
      palette: ViroPalette.light,
      mine: true,
      clubColor: club,
    );
    final other = ViroChat.bubbleColors(
      palette: ViroPalette.light,
      mine: false,
      clubColor: club,
    );

    expect(mine.background, ViroChat.bubbleMineLight);
    expect(mine.background.a, 1);
    expect(mine.border, isNull);
    expect(other.background, ViroColors.white);
    expect(other.border, isNull);
    expect(mine.text, ViroPalette.light.textPrimary);
  });

  test('sombre : fond noir, texte blanc, opposé du club pour moi, club pour '
      'les autres', () {
    final mine = ViroChat.bubbleColors(
      palette: ViroPalette.dark,
      mine: true,
      clubColor: club,
    );
    final other = ViroChat.bubbleColors(
      palette: ViroPalette.dark,
      mine: false,
      clubColor: club,
    );

    expect(mine.background, ViroChat.bubbleDark);
    expect(mine.text, ViroColors.white);
    // Club rouge → contour à l’opposé du cercle chromatique (cyan).
    final clubHue = HSLColor.fromColor(club).hue;
    final mineHue = HSLColor.fromColor(mine.border!).hue;
    expect(((mineHue - clubHue) % 360 - 180).abs(), lessThan(1));
    expect(mine.glow, isNotEmpty);
    expect(other.background, ViroChat.bubbleDark);
    expect(other.border, ViroPalette.dark.readableAccent(club));
  });

  test('sombre : couleur club quasi noire → contour blanc', () {
    final other = ViroChat.bubbleColors(
      palette: ViroPalette.dark,
      mine: false,
      clubColor: const Color(0xFF0A0A0A),
    );

    expect(other.border, ViroColors.white);
  });

  test('sombre : club sans teinte (gris / noir) → néon bleu pour moi', () {
    for (final neutral in const [Color(0xFF0A0A0A), Color(0xFF808080)]) {
      final mine = ViroChat.bubbleColors(
        palette: ViroPalette.dark,
        mine: true,
        clubColor: neutral,
      );
      expect(mine.border, ViroChat.bubbleMineNeon);
    }
  });
}
