import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/features/fees/utils/member_fee_status.dart';

/// Exports du suivi cotisations.
class FeeExport {
  /// Crée le module d'export cotisations.
  const FeeExport();

  /// Génère le CSV du trésorier pour une saison.
  Future<String> exportCsv({
    required String clubId,
    required String seasonId,
    required FeeSeason season,
    required List<MemberFee> fees,
  }) async {
    final buffer = StringBuffer();
    buffer.writeln('Nom;Catégorie;Montant;Statut;Date paiement;Notes admin');

    for (final fee in fees) {
      final tier = season.tierById(fee.tierId);
      final tierLabel = tier?.label ?? 'Non assigne';
      final amount = fee.status == MemberFeeStatus.exonere
          ? '0,00 EUR'
          : formatFeeAmountCents(fee.amountDueCents(season));
      final display = fee.displayStatus(season.paymentDeadlineAt);
      final statusLabel = display.label;
      final paidAt = fee.paidAt != null
          ? '${fee.paidAt!.day.toString().padLeft(2, '0')}/'
              '${fee.paidAt!.month.toString().padLeft(2, '0')}/'
              '${fee.paidAt!.year}'
          : '';
      final notes = (fee.notesAdmin ?? '').replaceAll(';', ',');
      buffer.writeln(
        '${fee.memberDisplayName};$tierLabel;$amount;$statusLabel;$paidAt;$notes',
      );
    }
    return buffer.toString();
  }
}
