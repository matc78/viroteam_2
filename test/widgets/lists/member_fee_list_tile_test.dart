import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/config/viro_theme.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/widgets/common/viro_selection_mark.dart';
import 'package:viro_team_v2/widgets/lists/member_fee_list_tile.dart';

void main() {
  final season = FeeSeason(
    id: 's1',
    seasonLabel: '2026-2027',
    isActive: true,
    tiers: const [FeeTier(tierId: 't1', label: 'U13', amountCents: 10000)],
    createdAt: DateTime(2026, 1, 1),
    updatedAt: DateTime(2026, 1, 1),
    createdBy: 'admin',
  );
  final fee = MemberFee(
    memberId: 'm1',
    memberDisplayName: 'Maël Girard',
    status: MemberFeeStatus.aPayer,
    tierId: 't1',
    createdAt: DateTime(2026, 1, 1),
    updatedAt: DateTime(2026, 1, 1),
  );

  Future<void> pump(
    WidgetTester tester, {
    required bool selectionMode,
    required bool selected,
    VoidCallback? onTap,
  }) => tester.pumpWidget(
    MaterialApp(
      theme: ViroTheme.light,
      home: Scaffold(
        body: MemberFeeListTile(
          fee: fee,
          season: season,
          selected: selected,
          selectionMode: selectionMode,
          onTap: onTap ?? () {},
        ),
      ),
    ),
  );

  testWidgets('hors sélection : avatar, pas de coche', (tester) async {
    await pump(tester, selectionMode: false, selected: false);

    expect(find.text('Maël Girard'), findsOneWidget);
    expect(find.byType(CircleAvatar), findsOneWidget);
    expect(find.byType(ViroSelectionMark), findsNothing);
  });

  testWidgets('en sélection : la coche remplace l’avatar et le tap passe',
      (tester) async {
    var taps = 0;
    await pump(
      tester,
      selectionMode: true,
      selected: true,
      onTap: () => taps++,
    );

    expect(find.byType(CircleAvatar), findsNothing);
    final mark = tester.widget<ViroSelectionMark>(
      find.byType(ViroSelectionMark),
    );
    expect(mark.value, isTrue);
    await tester.tap(find.byType(MemberFeeListTile));
    expect(taps, 1);
  });

  testWidgets('la sélection ne change pas la hauteur de la ligne',
      (tester) async {
    await pump(tester, selectionMode: true, selected: false);
    final before = tester.getSize(find.byType(MemberFeeListTile)).height;
    await pump(tester, selectionMode: true, selected: true);
    await tester.pumpAndSettle();
    expect(tester.getSize(find.byType(MemberFeeListTile)).height, before);
  });
}
