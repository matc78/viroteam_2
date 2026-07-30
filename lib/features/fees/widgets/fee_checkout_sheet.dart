import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/fees/models/fee_aid.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/services/payment/payment_service.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Bottom sheet membre : aides + 1×/3× + lancement HelloAsso.
class FeeCheckoutSheet extends StatefulWidget {
  const FeeCheckoutSheet({
    super.key,
    required this.season,
    required this.fee,
    required this.onConfirm,
  });

  final FeeSeason season;
  final MemberFee fee;
  final Future<PaymentCheckoutResult> Function({
    required int cardAmountCents,
    required int installmentCount,
    required List<FeeAidDraft> aids,
  }) onConfirm;

  @override
  State<FeeCheckoutSheet> createState() => _FeeCheckoutSheetState();
}

class _FeeCheckoutSheetState extends State<FeeCheckoutSheet> {
  bool _useAid = false;
  String _aidType = FeeAidTypes.passSport;
  final _aidAmountCtrl = TextEditingController();
  final _promoCtrl = TextEditingController();
  int _installmentCount = 1;
  bool _submitting = false;

  @override
  void dispose() {
    _aidAmountCtrl.dispose();
    _promoCtrl.dispose();
    super.dispose();
  }

  int get _due => widget.fee.amountDueCents(widget.season);

  int get _aidCents {
    if (!_useAid) return 0;
    final raw = _aidAmountCtrl.text.replaceAll(',', '.').trim();
    final euros = double.tryParse(raw) ?? 0;
    return (euros * 100).round().clamp(0, _due);
  }

  int get _cardCents {
    final remaining = widget.fee.remainingCents(widget.season);
    final card = remaining - _aidCents;
    return card < 0 ? 0 : card;
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      final aids = <FeeAidDraft>[];
      if (_useAid && _aidCents > 0) {
        aids.add(
          FeeAidDraft(
            type: _aidType,
            amountCents: _aidCents,
            promoCode: _promoCtrl.text.trim().isEmpty
                ? null
                : _promoCtrl.text.trim(),
            label: FeeAidTypes.label(_aidType),
          ),
        );
      }
      final result = await widget.onConfirm(
        cardAmountCents: _cardCents,
        installmentCount: _installmentCount,
        aids: aids,
      );
      if (!mounted) return;
      Navigator.pop(context, result);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.md,
        ViroSpacing.screenHorizontal,
        ViroSpacing.lg + bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Payer ma cotisation',
              style: theme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: ViroSpacing.xs),
            Text(
              'Total dû : ${formatFeeAmountCents(_due)}',
              style: theme.bodyMedium?.copyWith(color: ViroColors.gray600),
            ),
            const SizedBox(height: ViroSpacing.md),

            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('J\'ai une aide / réduction'),
              subtitle: const Text('Pass\'Sport, Pass+, ANCV, code promo…'),
              value: _useAid,
              onChanged: (v) => setState(() => _useAid = v),
            ),
            if (_useAid) ...[
              DropdownButtonFormField<String>(
                initialValue: _aidType,
                decoration: const InputDecoration(labelText: 'Type d\'aide'),
                items: [
                  for (final t in FeeAidTypes.all)
                    DropdownMenuItem(value: t, child: Text(FeeAidTypes.label(t))),
                ],
                onChanged: (v) {
                  if (v != null) setState(() => _aidType = v);
                },
              ),
              const SizedBox(height: ViroSpacing.sm),
              TextField(
                controller: _aidAmountCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Montant de l\'aide (€)',
                  hintText: '50',
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                ],
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: ViroSpacing.sm),
              TextField(
                controller: _promoCtrl,
                decoration: const InputDecoration(
                  labelText: 'Code promo (optionnel)',
                ),
              ),
              const SizedBox(height: ViroSpacing.sm),
              Text(
                'L\'aide passera en « attente de justificatif » ; '
                'seul le reste est encaissé par carte.',
                style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
              ),
            ],

            const SizedBox(height: ViroSpacing.md),
            Text(
              'Paiement carte (HelloAsso)',
              style: theme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: ViroSpacing.sm),
            SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 1, label: Text('1 fois')),
                ButtonSegment(value: 3, label: Text('3 fois')),
              ],
              selected: {_installmentCount},
              onSelectionChanged: (s) {
                setState(() => _installmentCount = s.first);
              },
            ),
            const SizedBox(height: ViroSpacing.md),

            DecoratedBox(
              decoration: BoxDecoration(
                color: ViroColors.primary50,
                borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
              ),
              child: Padding(
                padding: const EdgeInsets.all(ViroSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_aidCents > 0)
                      Text(
                        'Aide : − ${formatFeeAmountCents(_aidCents)}',
                        style: theme.bodyMedium,
                      ),
                    Text(
                      'À payer par CB : ${formatFeeAmountCents(_cardCents)}'
                      '${_installmentCount == 3 ? ' (en 3 fois)' : ''}',
                      style: theme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: ViroSpacing.md),
            ViroPrimaryButton(
              label: _submitting
                  ? 'Ouverture…'
                  : _cardCents > 0
                      ? 'Payer ${formatFeeAmountCents(_cardCents)}'
                      : 'Enregistrer l\'aide',
              onPressed: _submitting ? null : _submit,
            ),
            const SizedBox(height: ViroSpacing.sm),
            Row(
              children: [
                ViroIcon(ViroIcons.bell, size: 16, color: ViroColors.gray600),
                const SizedBox(width: ViroSpacing.xs),
                Expanded(
                  child: Text(
                    'La cotisation n\'est confirmée qu\'après le webhook HelloAsso, '
                    'pas au retour dans l\'app.',
                    style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
