import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_mark_paid_dialogs.dart';
import 'package:viro_team_v2/features/fees/widgets/fee_tracking_stats_card.dart';

void main() {
  final season = FeeSeason(
    id: 's1',
    seasonLabel: '2026-2027',
    isActive: true,
    currency: 'EUR',
    paymentInstructions: '',
    paymentMethods: const [],
    tiers: const [
      FeeTier(tierId: 't1', label: 'U13', amountCents: 10000),
    ],
    createdAt: DateTime(2026, 1, 1),
    updatedAt: DateTime(2026, 1, 1),
    createdBy: 'admin',
  );

  MemberFee fee(
    String id, {
    int amountPaidCents = 0,
    MemberFeeStatus status = MemberFeeStatus.aPayer,
  }) {
    return MemberFee(
      memberId: id,
      memberDisplayName: id,
      status: status,
      tierId: 't1',
      amountPaidCents: amountPaidCents,
      createdAt: DateTime(2026, 1, 1),
      updatedAt: DateTime(2026, 1, 1),
    );
  }

  final fees = [
    fee('m1', amountPaidCents: 10000, status: MemberFeeStatus.paye),
    fee('m2', amountPaidCents: 4000, status: MemberFeeStatus.partiel),
    fee('m3'),
    fee('m4', status: MemberFeeStatus.exonere),
  ];

  test('FeeStats agrège encaissé et restant quand la saison est fournie', () {
    final stats = FeeStats.compute(fees, null, season: season);
    expect(stats.total, 4);
    expect(stats.paid, 1);
    expect(stats.exempt, 1);
    expect(stats.collectedCents, 14000);
    expect(stats.remainingCents, 16000);
  });

  test('FeeStats sans saison : montants à zéro', () {
    final stats = FeeStats.compute(fees, null);
    expect(stats.collectedCents, 0);
    expect(stats.remainingCents, 0);
  });

  testWidgets('FeeTrackingStatsCard affiche taux, barre et montants',
      (tester) async {
    final stats = FeeStats.compute(fees, null, season: season);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: FeeTrackingStatsCard(stats: stats)),
      ),
    );

    expect(find.text(AppCopy.fees.statsPaidRate(25)), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.text(formatFeeAmountCents(14000)), findsOneWidget);
    expect(find.text(formatFeeAmountCents(16000)), findsOneWidget);
  });

  testWidgets('confirmation Marquer payé : annuler renvoie false',
      (tester) async {
    bool? result;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () async {
              result = await showFeeMarkPaidConfirmDialog(
                context,
                title: AppCopy.fees.markPaidConfirmTitle(3),
                body: 'corps',
              );
            },
            child: const Text('ouvrir'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();
    expect(find.text(AppCopy.fees.markPaidConfirmTitle(3)), findsOneWidget);

    await tester.tap(find.text(AppCopy.common.cancel));
    await tester.pumpAndSettle();
    expect(result, isFalse);

    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();
    await tester.tap(find.text(AppCopy.fees.markPaid));
    await tester.pumpAndSettle();
    expect(result, isTrue);
  });

  testWidgets('FeeBulkProgressDialog suit la progression', (tester) async {
    final progress = ValueNotifier<int>(0);
    addTearDown(progress.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: FeeBulkProgressDialog(progress: progress, total: 12),
        ),
      ),
    );
    expect(find.text(AppCopy.fees.markPaidProgress(0, 12)), findsOneWidget);

    progress.value = 3;
    await tester.pump();
    expect(find.text(AppCopy.fees.markPaidProgress(3, 12)), findsOneWidget);
  });
}
