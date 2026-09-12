import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';

/// Résultat du recalcul de statut cotisation (dû / payé / aides).
class MemberFeeStatusResolution {
  const MemberFeeStatusResolution({
    required this.statusValue,
    required this.isFullyPaid,
    required this.clearPaidAt,
  });

  /// Valeur Firestore (`a_payer` / `partiel` / `paye` / `exonere`).
  final String statusValue;

  /// Vrai si le reste dû est nul et aucune aide n'est en attente.
  final bool isFullyPaid;

  /// Vrai si `paidAt` doit être effacé.
  final bool clearPaidAt;
}

/// Montant catalogue dû pour un palier (0 si exonéré ou sans palier).
int amountDueCentsForTier({
  required FeeSeason season,
  required String? tierId,
  required bool isExempt,
}) {
  if (isExempt || tierId == null || tierId.isEmpty) return 0;
  return season.tierById(tierId)?.amountCents ?? 0;
}

/// Recalcule le statut stocké à partir du dû, du payé et des aides.
MemberFeeStatusResolution resolveMemberFeePaymentStatus({
  required bool isExempt,
  required int dueCents,
  required int amountPaidCents,
  required int validatedAidsCents,
  required bool hasPendingAids,
}) {
  if (isExempt) {
    return const MemberFeeStatusResolution(
      statusValue: MemberFeeStatuses.exonere,
      isFullyPaid: false,
      clearPaidAt: true,
    );
  }

  final covered = amountPaidCents + validatedAidsCents;
  final remaining = dueCents - covered;

  if (remaining <= 0 && !hasPendingAids) {
    return const MemberFeeStatusResolution(
      statusValue: MemberFeeStatuses.paye,
      isFullyPaid: true,
      clearPaidAt: false,
    );
  }

  if (amountPaidCents > 0 || validatedAidsCents > 0) {
    return const MemberFeeStatusResolution(
      statusValue: MemberFeeStatuses.partiel,
      isFullyPaid: false,
      clearPaidAt: true,
    );
  }

  return const MemberFeeStatusResolution(
    statusValue: MemberFeeStatuses.aPayer,
    isFullyPaid: false,
    clearPaidAt: true,
  );
}
