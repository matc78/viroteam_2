import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/features/fees/models/fee_aid.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';

void main() {
  final season = FeeSeason(
    id: 's1',
    seasonLabel: '2026-2027',
    isActive: true,
    currency: 'EUR',
    paymentInstructions: '',
    paymentMethods: const [],
    tiers: const [
      FeeTier(tierId: 't1', label: 'U13', amountCents: 18000),
    ],
    createdAt: DateTime(2026, 1, 1),
    updatedAt: DateTime(2026, 1, 1),
    createdBy: 'admin',
  );

  MemberFee fee({
    int amountPaidCents = 0,
    List<FeeAid> aids = const [],
    MemberFeeStatus status = MemberFeeStatus.aPayer,
  }) {
    return MemberFee(
      memberId: 'm1',
      memberDisplayName: 'Test',
      status: status,
      tierId: 't1',
      amountPaidCents: amountPaidCents,
      aids: aids,
      createdAt: DateTime(2026, 1, 1),
      updatedAt: DateTime(2026, 1, 1),
    );
  }

  test('PassSport 50€ → CB 130€, aide pending', () {
    final memberFee = fee(
      aids: [
        FeeAid(
          id: 'a1',
          type: FeeAidTypes.passSport,
          label: "Pass'Sport",
          amountCents: 5000,
          status: FeeAidStatuses.pendingProof,
          createdAt: DateTime(2026, 1, 1),
        ),
      ],
    );

    expect(memberFee.amountDueCents(season), 18000);
    expect(memberFee.cardCheckoutCents(season), 13000);
    expect(memberFee.pendingAidsCents, 5000);
    expect(memberFee.remainingCents(season), 18000);
  });

  test('CB 130€ + aide validée → payé', () {
    final memberFee = fee(
      amountPaidCents: 13000,
      status: MemberFeeStatus.partiel,
      aids: [
        FeeAid(
          id: 'a1',
          type: FeeAidTypes.passSport,
          label: "Pass'Sport",
          amountCents: 5000,
          status: FeeAidStatuses.validated,
          createdAt: DateTime(2026, 1, 1),
        ),
      ],
    );

    expect(memberFee.coveredCents(season), 18000);
    expect(memberFee.remainingCents(season), 0);
    expect(memberFee.cardCheckoutCents(season), 0);
  });
}
