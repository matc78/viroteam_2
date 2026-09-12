import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Actions groupées terrain : marquer payé + assigner tarif.
class FeeBulkActionSheet extends StatelessWidget {
  const FeeBulkActionSheet({
    super.key,
    required this.selectedCount,
    required this.tiers,
    required this.onMarkPaid,
    required this.onAssignTier,
  });

  final int selectedCount;
  final List<FeeTier> tiers;
  final VoidCallback onMarkPaid;
  final ValueChanged<String> onAssignTier;

  /// Affiche le sheet d’actions groupées.
  static Future<void> show(
    BuildContext context, {
    required int selectedCount,
    required List<FeeTier> tiers,
    required VoidCallback onMarkPaid,
    required ValueChanged<String> onAssignTier,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => FeeBulkActionSheet(
        selectedCount: selectedCount,
        tiers: tiers,
        onMarkPaid: () {
          Navigator.pop(ctx);
          onMarkPaid();
        },
        onAssignTier: (tierId) {
          Navigator.pop(ctx);
          onAssignTier(tierId);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(ViroSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              AppCopy.fees.selectedMembers(selectedCount),
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: ViroSpacing.md),
            ListTile(
              leading: ViroIcon(ViroIcons.check),
              title: Text(AppCopy.fees.markPaid),
              subtitle: Text(AppCopy.fees.markPaidOfflineHint),
              onTap: onMarkPaid,
            ),
            if (tiers.isNotEmpty) ...[
              const Divider(),
              Text(
                AppCopy.fees.assignCategory,
                style: Theme.of(context).textTheme.labelLarge,
              ),
              for (final tier in tiers)
                ListTile(
                  title: Text(tier.label),
                  subtitle: Text(tier.formattedAmount),
                  onTap: () => onAssignTier(tier.tierId),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
