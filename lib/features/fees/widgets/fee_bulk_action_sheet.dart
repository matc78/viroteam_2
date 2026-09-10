import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

class FeeBulkActionSheet extends StatelessWidget {
  const FeeBulkActionSheet({
    super.key,
    required this.selectedCount,
    required this.tiers,
    required this.onMarkPaid,
    required this.onMarkExempt,
    required this.onMarkUnpaid,
    required this.onAssignTier,
  });

  final int selectedCount;
  final List<FeeTier> tiers;
  final VoidCallback onMarkPaid;
  final VoidCallback onMarkExempt;
  final VoidCallback onMarkUnpaid;
  final ValueChanged<String> onAssignTier;

  static Future<void> show(
    BuildContext context, {
    required int selectedCount,
    required List<FeeTier> tiers,
    required VoidCallback onMarkPaid,
    required VoidCallback onMarkExempt,
    required VoidCallback onMarkUnpaid,
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
        onMarkExempt: () {
          Navigator.pop(ctx);
          onMarkExempt();
        },
        onMarkUnpaid: () {
          Navigator.pop(ctx);
          onMarkUnpaid();
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
              leading: const Icon(Icons.check_circle_outline),
              title: Text(AppCopy.fees.markPaid),
              onTap: onMarkPaid,
            ),
            ListTile(
              leading: const Icon(Icons.remove_circle_outline),
              title: Text(AppCopy.fees.markExempt),
              onTap: onMarkExempt,
            ),
            ListTile(
              leading: const Icon(Icons.schedule),
              title: Text(AppCopy.fees.markUnpaid),
              onTap: onMarkUnpaid,
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
