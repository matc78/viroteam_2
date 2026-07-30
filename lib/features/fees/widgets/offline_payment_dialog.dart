import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';

/// Dialogue trésorier : valider un paiement hors-ligne.
class OfflinePaymentDialog extends StatefulWidget {
  const OfflinePaymentDialog({
    super.key,
    required this.memberDisplayName,
    required this.remainingCents,
  });

  final String memberDisplayName;
  final int remainingCents;

  @override
  State<OfflinePaymentDialog> createState() => _OfflinePaymentDialogState();
}

class _OfflinePaymentDialogState extends State<OfflinePaymentDialog> {
  late String _method;
  late final TextEditingController _amountCtrl;

  @override
  void initState() {
    super.initState();
    _method = FeePaymentMethods.cheque;
    final euros = (widget.remainingCents / 100).toStringAsFixed(2);
    _amountCtrl = TextEditingController(text: euros.replaceAll('.', ','));
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  int get _amountCents {
    final raw = _amountCtrl.text.replaceAll(',', '.').trim();
    final euros = double.tryParse(raw) ?? 0;
    return (euros * 100).round();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Valider hors-ligne'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.memberDisplayName),
            const SizedBox(height: ViroSpacing.sm),
            Text(
              'Reste : ${formatFeeAmountCents(widget.remainingCents)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: ViroSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _method,
              decoration: const InputDecoration(labelText: 'Moyen'),
              items: [
                for (final m in FeePaymentMethods.offline)
                  DropdownMenuItem(
                    value: m,
                    child: Text(FeePaymentMethods.label(m)),
                  ),
              ],
              onChanged: (v) {
                if (v != null) setState(() => _method = v);
              },
            ),
            const SizedBox(height: ViroSpacing.sm),
            TextField(
              controller: _amountCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Montant (€)'),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
              ],
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Annuler'),
        ),
        TextButton(
          onPressed: _amountCents <= 0
              ? null
              : () => Navigator.pop(
                    context,
                    (method: _method, amountCents: _amountCents),
                  ),
          child: const Text('Valider'),
        ),
      ],
    );
  }
}
