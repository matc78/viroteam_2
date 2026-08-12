import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Placeholder affiché à la place du portail de paiement HelloAsso.
class PaymentSoonScreen extends StatelessWidget {
  const PaymentSoonScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return ViroScaffold(
      appBar: const ViroAppBar(
        title: Text('Payer en ligne'),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(ViroSpacing.screenHorizontal),
          child: ViroCard(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ViroIcon(
                  ViroIcons.payments,
                  color: ViroColors.primary600,
                  size: 40,
                ),
                const SizedBox(height: ViroSpacing.md),
                Text(
                  'Bientôt disponible',
                  textAlign: TextAlign.center,
                  style: theme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: ViroColors.primary800,
                  ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                Text(
                  'Le paiement en ligne via HelloAsso arrive bientôt. '
                  'En attendant, utilisez les moyens de paiement indiqués '
                  'par votre club.',
                  textAlign: TextAlign.center,
                  style: theme.bodyMedium?.copyWith(
                    color: ViroColors.gray600,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
