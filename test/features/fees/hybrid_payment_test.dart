import 'package:flutter_test/flutter_test.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/fees/models/fee_aid.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/utils/member_fee_status.dart';

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
      FeeTier(tierId: 't2', label: 'U15', amountCents: 12000),
      FeeTier(tierId: 't3', label: 'Senior', amountCents: 5000),
    ],
    createdAt: DateTime(2026, 1, 1),
    updatedAt: DateTime(2026, 1, 1),
    createdBy: 'admin',
  );

  MemberFee fee({
    int amountPaidCents = 0,
    List<FeeAid> aids = const [],
    MemberFeeStatus status = MemberFeeStatus.aPayer,
    String? tierId = 't1',
  }) {
    return MemberFee(
      memberId: 'm1',
      memberDisplayName: 'Test',
      status: status,
      tierId: tierId,
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

  test('changement de palier avec déjà payé → partiel ou payé', () {
    final paidPartial = resolveMemberFeePaymentStatus(
      isExempt: false,
      dueCents: amountDueCentsForTier(
        season: season,
        tierId: 't2',
        isExempt: false,
      ),
      amountPaidCents: 5000,
      validatedAidsCents: 0,
      hasPendingAids: false,
    );
    expect(paidPartial.statusValue, MemberFeeStatuses.partiel);
    expect(
      amountDueCentsForTier(season: season, tierId: 't2', isExempt: false),
      12000,
    );

    final paidEnough = resolveMemberFeePaymentStatus(
      isExempt: false,
      dueCents: amountDueCentsForTier(
        season: season,
        tierId: 't3',
        isExempt: false,
      ),
      amountPaidCents: 5000,
      validatedAidsCents: 0,
      hasPendingAids: false,
    );
    expect(paidEnough.statusValue, MemberFeeStatuses.paye);
    expect(paidEnough.isFullyPaid, isTrue);
  });

  test('ajustement absolu trop haut / trop bas → bons statuts', () {
    final overpaid = resolveMemberFeePaymentStatus(
      isExempt: false,
      dueCents: 18000,
      amountPaidCents: 20000,
      validatedAidsCents: 0,
      hasPendingAids: false,
    );
    expect(overpaid.statusValue, MemberFeeStatuses.paye);

    final underpaid = resolveMemberFeePaymentStatus(
      isExempt: false,
      dueCents: 18000,
      amountPaidCents: 3000,
      validatedAidsCents: 0,
      hasPendingAids: false,
    );
    expect(underpaid.statusValue, MemberFeeStatuses.partiel);

    final resetToZero = resolveMemberFeePaymentStatus(
      isExempt: false,
      dueCents: 18000,
      amountPaidCents: 0,
      validatedAidsCents: 0,
      hasPendingAids: false,
    );
    expect(resetToZero.statusValue, MemberFeeStatuses.aPayer);
    expect(resetToZero.clearPaidAt, isTrue);
  });

  test('reste dû après baisse du déjà payé', () {
    final memberFee = fee(amountPaidCents: 8000, status: MemberFeeStatus.partiel);
    expect(memberFee.remainingCents(season), 10000);

    final afterAdjust = resolveMemberFeePaymentStatus(
      isExempt: false,
      dueCents: memberFee.amountDueCents(season),
      amountPaidCents: 2000,
      validatedAidsCents: 0,
      hasPendingAids: false,
    );
    expect(afterAdjust.statusValue, MemberFeeStatuses.partiel);
    expect(18000 - 2000, 16000);
  });

  test('assigner un palier à un exonéré → plus exonéré', () {
    final afterAssign = resolveMemberFeePaymentStatus(
      isExempt: false,
      dueCents: amountDueCentsForTier(
        season: season,
        tierId: 't1',
        isExempt: false,
      ),
      amountPaidCents: 0,
      validatedAidsCents: 0,
      hasPendingAids: false,
    );
    expect(afterAssign.statusValue, MemberFeeStatuses.aPayer);
    expect(afterAssign.statusValue, isNot(MemberFeeStatuses.exonere));
  });
}
