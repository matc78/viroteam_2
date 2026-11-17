import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_glyphs.dart';
import 'package:viro_team_v2/features/members/utils/permission_glyphs.dart';
import 'package:viro_team_v2/models/club_permission.dart';

void main() {
  testWidgets('chaque icône sur mesure a son SVG embarqué', (tester) async {
    for (final glyph in ViroGlyph.values) {
      final svg = await rootBundle.loadString(glyph.assetPath);
      expect(svg, contains('<svg'), reason: glyph.assetPath);
    }
  });

  testWidgets('ViroGlyphIcon se rend, décorative par défaut', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Center(child: ViroGlyphIcon(ViroGlyph.sifflet, size: 28)),
      ),
    );
    expect(find.byType(SvgPicture), findsOneWidget);
    expect(tester.getSize(find.byType(SvgPicture)), const Size.square(28));
    expect(
      find.descendant(
        of: find.byType(ViroGlyphIcon),
        matching: find.byType(ExcludeSemantics),
      ),
      findsOneWidget,
    );
  });

  test('chaque droit et chaque fonction a une icône', () {
    // Les switch exhaustifs garantissent la couverture ; ce test fige les
    // icônes partagées entre droit et fonction.
    expect(
      glyphOfFunction(ClubFunction.feesManager),
      glyphOfPermission(ClubPermission.manageFees),
    );
    expect(
      glyphOfFunction(ClubFunction.membersManager),
      glyphOfPermission(ClubPermission.manageMembers),
    );
    expect(glyphOfFunction(ClubFunction.sportsManager), ViroGlyph.sifflet);
    expect(
      {for (final permission in ClubPermission.values) glyphOfPermission(permission)},
      hasLength(ClubPermission.values.length),
      reason: 'deux droits ne partagent pas une icône',
    );
  });
}
