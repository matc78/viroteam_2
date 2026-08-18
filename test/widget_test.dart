import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/screens/dev/design_system_preview_screen.dart';

void main() {
  testWidgets('affiche l\'aperçu du design system', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ViroTheme.light,
        home: const DesignSystemPreviewScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('ViroTeam v2'), findsOneWidget);
    expect(find.text('Design system'), findsOneWidget);
    expect(find.text('ICÔNES PHOSPHOR'), findsOneWidget);
    expect(find.text('menu'), findsOneWidget);
    expect(find.text('ball'), findsOneWidget);
  });
}
