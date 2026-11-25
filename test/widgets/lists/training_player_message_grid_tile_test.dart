import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_expandable_tile_grid.dart';
import 'package:viro_team_v2/widgets/lists/training_player_message_grid_tile.dart';

const _players = [
  ClubMember(
    memberId: 'm1',
    status: 'active',
    firstName: 'Léa',
    lastName: 'Martin',
  ),
  ClubMember(
    memberId: 'm2',
    status: 'active',
    firstName: 'Tom',
    lastName: 'Roux',
  ),
  ClubMember(
    memberId: 'm3',
    status: 'active',
    firstName: 'Inès',
    lastName: 'Morel',
  ),
];

/// Grille de test : l'état « déplié » vit ici, comme dans l'écran.
class _GridHarness extends StatefulWidget {
  const _GridHarness({required this.onChanged});

  final ValueChanged<String> onChanged;

  @override
  State<_GridHarness> createState() => _GridHarnessState();
}

class _GridHarnessState extends State<_GridHarness> {
  String? _expanded;

  @override
  Widget build(BuildContext context) {
    final textScaler = MediaQuery.textScalerOf(context);
    final expandedIndex = _players.indexWhere((p) => p.memberId == _expanded);
    return ViroExpandableTileGrid(
      itemCount: _players.length,
      expandedIndex: expandedIndex < 0 ? null : expandedIndex,
      tileHeight: TrainingPlayerMessageGridTile.compactHeight(textScaler),
      expandedHeight: TrainingPlayerMessageGridTile.expandedHeight(textScaler),
      itemKey: (index) => ValueKey(_players[index].memberId),
      itemBuilder: (_, index, expanded) => TrainingPlayerMessageGridTile(
        member: _players[index],
        message: '',
        expanded: expanded,
        onExpand: () => setState(() => _expanded = _players[index].memberId),
        onCollapse: () => setState(() => _expanded = null),
        onChanged: widget.onChanged,
      ),
    );
  }
}

void main() {
  testWidgets(
    'un tap déplie la tuile sur toute la ligne et pousse les autres',
    (tester) async {
      String? typed;
      await tester.pumpWidget(
        MaterialApp(
          theme: ViroTheme.light,
          home: Scaffold(
            body: SingleChildScrollView(
              child: _GridHarness(onChanged: (text) => typed = text),
            ),
          ),
        ),
      );

      // Compactes : trois joueurs sur la même ligne, pas de champ.
      expect(find.byType(TextField), findsNothing);
      final tomTop = tester.getTopLeft(find.text('Tom')).dy;
      expect(tester.getTopLeft(find.text('Léa')).dy, tomTop);

      await tester.tap(find.text('Léa'));
      await tester.pumpAndSettle();

      expect(find.byType(TextField), findsOneWidget);
      expect(find.text('Léa Martin'), findsOneWidget);
      // Tom glisse sous la tuile dépliée.
      expect(tester.getTopLeft(find.text('Tom')).dy, greaterThan(tomTop));

      await tester.enterText(find.byType(TextField), 'Super service');
      expect(typed, 'Super service');

      await tester.tap(find.byTooltip(AppCopy.training.playerMessageCollapse));
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsNothing);
      expect(tester.getTopLeft(find.text('Tom')).dy, tomTop);
    },
  );
}
