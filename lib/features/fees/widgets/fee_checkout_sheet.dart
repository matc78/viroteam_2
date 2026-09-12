import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/fees/models/fee_season.dart';
import 'package:viro_team_v2/features/fees/models/member_fee.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/services/payment/payment_service.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Bottom sheet membre : récapitulatif et lancement Stripe (1×).
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
  bool _submitting = false;

  int get _due => widget.fee.amountDueCents(widget.season);

  int get _cardCents {
    final remaining = widget.fee.remainingCents(widget.season);
    return remaining < 0 ? 0 : remaining;
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      final result = await widget.onConfirm(
        cardAmountCents: _cardCents,
        installmentCount: 1,
        aids: const [],
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
              child: Text(
                AppCopy.fees.cardAmountDue(
                  formatFeeAmountCents(_cardCents),
                  inThreeTimes: false,
                ),
                style: theme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          const SizedBox(height: ViroSpacing.md),
          ViroPrimaryButton(
            label: _submitting
                ? AppCopy.fees.opening
                : AppCopy.fees.payAmount(formatFeeAmountCents(_cardCents)),
            onPressed: _submitting || _cardCents <= 0 ? null : _submit,
          ),
        ],
      ),
    );
  }
}
