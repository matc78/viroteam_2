import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/fees/models/fee_aid.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/services/payment/payment_service.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Bottom sheet membre : aides + lancement Stripe (1×).
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
        installmentCount: 1,
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
              AppCopy.fees.checkoutTitle,
              style: theme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: ViroSpacing.xs),
            Text(
              AppCopy.fees.totalDue(formatFeeAmountCents(_due)),
              style: theme.bodyMedium?.copyWith(color: ViroColors.gray600),
            ),
            const SizedBox(height: ViroSpacing.md),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(AppCopy.fees.hasAidToggle),
              subtitle: Text(AppCopy.fees.hasAidSubtitle),
              value: _useAid,
              onChanged: (v) => setState(() => _useAid = v),
            ),
            if (_useAid) ...[
              DropdownButtonFormField<String>(
                initialValue: _aidType,
                decoration: InputDecoration(labelText: AppCopy.fees.aidType),
                items: [
                  for (final t in FeeAidTypes.all)
                    DropdownMenuItem(
                      value: t,
                      child: Text(FeeAidTypes.label(t)),
                    ),
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
                decoration: InputDecoration(
                  labelText: AppCopy.fees.aidAmountEuros,
                  hintText: AppCopy.fees.aidAmountHint,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                ],
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: ViroSpacing.sm),
              TextField(
                controller: _promoCtrl,
                decoration: InputDecoration(
                  labelText: AppCopy.fees.promoCodeOptional,
                ),
              ),
              const SizedBox(height: ViroSpacing.sm),
              Text(
                AppCopy.fees.aidPendingHint,
                style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
              ),
            ],
            const SizedBox(height: ViroSpacing.md),
            Text(
              AppCopy.fees.cardPaymentStripe,
              style: theme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
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
                        AppCopy.fees
                            .aidDiscount(formatFeeAmountCents(_aidCents)),
                        style: theme.bodyMedium,
                      ),
                    Text(
                      AppCopy.fees.cardAmountDue(
                        formatFeeAmountCents(_cardCents),
                        inThreeTimes: false,
                      ),
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
                  ? AppCopy.fees.opening
                  : _cardCents > 0
                      ? AppCopy.fees.payAmount(formatFeeAmountCents(_cardCents))
                      : AppCopy.fees.saveAid,
              onPressed: _submitting ? null : _submit,
            ),
            const SizedBox(height: ViroSpacing.sm),
            Row(
              children: [
                ViroIcon(ViroIcons.bell, size: 16, color: ViroColors.gray600),
                const SizedBox(width: ViroSpacing.xs),
                Expanded(
                  child: Text(
                    AppCopy.fees.webhookConfirmHint,
                    style:
                        theme.bodySmall?.copyWith(color: ViroColors.gray600),
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
