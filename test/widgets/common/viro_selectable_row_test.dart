import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_selectable_row.dart';
import 'package:viro_team_v2/widgets/common/viro_selection_mark.dart';

void main() {
  Future<void> pumpRow(WidgetTester tester, Widget row) => tester.pumpWidget(
    MaterialApp(
      theme: ViroTheme.light,
      home: Scaffold(body: row),
    ),
  );

  testWidgets('un tap sélectionne, un second rend la forme d’origine',
      (tester) async {
    var selected = false;
    await pumpRow(
      tester,
      StatefulBuilder(
        builder: (context, setState) => ViroSelectableRow(
          selected: selected,
          title: 'Inès Morel',
          onChanged: (value) => setState(() => selected = value),
        ),
      ),
    );
    final restHeight = tester.getSize(find.byType(ViroSelectableRow)).height;

    await tester.tap(find.byType(ViroSelectableRow));
    await tester.pumpAndSettle();
    expect(selected, isTrue);
    expect(
      tester.widget<ViroSelectionMark>(find.byType(ViroSelectionMark)).value,
      isTrue,
    );
    expect(tester.getSize(find.byType(ViroSelectableRow)).height, restHeight);

    await tester.tap(find.byType(ViroSelectableRow));
    await tester.pumpAndSettle();
    expect(selected, isFalse);
    expect(tester.getSize(find.byType(ViroSelectableRow)).height, restHeight);
  });

  testWidgets('verrouillée : le tap ne change rien', (tester) async {
    await pumpRow(
      tester,
      const ViroSelectableRow(
        selected: true,
        title: 'Tom Garnier',
        onChanged: null,
      ),
    );

    await tester.tap(find.byType(ViroSelectableRow));
    expect(
      tester.widget<ViroSelectionMark>(find.byType(ViroSelectionMark)).enabled,
      isFalse,
    );
  });

  testWidgets('coche en tête si markLeading', (tester) async {
    await pumpRow(
      tester,
      ViroSelectableRow(
        selected: false,
        title: 'Jade Lefèvre',
        markLeading: true,
        onChanged: (_) {},
      ),
    );

    final markX = tester.getCenter(find.byType(ViroSelectionMark)).dx;
    final titleX = tester.getCenter(find.text('Jade Lefèvre')).dx;
    expect(markX, lessThan(titleX));
  });

  testWidgets('sémantique : case cochée avec son libellé', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpRow(
      tester,
      ViroSelectableRow(
        selected: true,
        title: 'Noah Petit',
        onChanged: (_) {},
      ),
    );

    expect(
      tester.getSemantics(find.byType(ViroSelectableRow)),
      matchesSemantics(
        label: 'Noah Petit',
        hasCheckedState: true,
        isChecked: true,
        hasEnabledState: true,
        isEnabled: true,
        isButton: true,
        hasTapAction: true,
      ),
    );
    handle.dispose();
  });
}
