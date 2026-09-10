import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Placeholder affiché si le flux paiement Stripe n'est pas disponible.
class PaymentSoonScreen extends ConsumerWidget {
  const PaymentSoonScreen({super.key, required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context).textTheme;
    final accent = ref.watch(clubMemberAccentProvider(clubId));

    return ClubAccentTheme(
      accentColor: accent,
      child: ViroScaffold(
      appBar: ViroAppBar(
        title: Text(AppCopy.fees.payOnlineTitle),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(ViroSpacing.screenHorizontal),
          child: ViroCard(
            accentColor: accent,
            borderColor: ClubAccentStyle(accent).border,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ViroIcon(
                  ViroIcons.payments,
                  color: accent,
                  size: 40,
                ),
                const SizedBox(height: ViroSpacing.md),
                Text(
                  AppCopy.fees.comingSoon,
                  textAlign: TextAlign.center,
                  style: theme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: accent,
                  ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                Text(
                  AppCopy.fees.paymentSoonBody,
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
      ),
    );
  }
}
