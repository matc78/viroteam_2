import 'dart:math';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/fees/models/fee_tier.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';

/// Éditeur de paliers tarifaires (libellé + montant).
class FeeTierEditor extends StatelessWidget {
  const FeeTierEditor({
    super.key,
    required this.tiers,
    required this.onChanged,
    this.accentColor,
    this.onDeleteTier,
  });

  final List<FeeTier> tiers;
  final ValueChanged<List<FeeTier>> onChanged;
  final Color? accentColor;
  final Future<bool> Function(FeeTier tier)? onDeleteTier;

  void _addTier() {
    onChanged([
      ...tiers,
      FeeTier(
        tierId:
            'tier_${DateTime.now().microsecondsSinceEpoch}_${Random().nextInt(9999)}',
        label: '',
        amountCents: 0,
      ),
    ]);
  }

  Future<void> _removeTier(int index) async {
    if (tiers.length <= 1) return;
    final tier = tiers[index];
    if (onDeleteTier != null) {
      final confirmed = await onDeleteTier!(tier);
      if (!confirmed) return;
    }
    final next = List<FeeTier>.from(tiers)..removeAt(index);
    onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final accent = accentColor ?? ViroColors.primary600;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var index = 0; index < tiers.length; index++) ...[
          if (index > 0) const SizedBox(height: ViroSpacing.sm),
          _TierCard(
            key: ValueKey(tiers[index].tierId),
            index: index,
            tier: tiers[index],
            accentColor: accent,
            canDelete: tiers.length > 1,
            onUpdate: (updated) {
              final next = List<FeeTier>.from(tiers);
              next[index] = updated;
              onChanged(next);
            },
            onDelete: () => _removeTier(index),
          ),
        ],
        const SizedBox(height: ViroSpacing.sm),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: _addTier,
            icon: ViroIcon(ViroIcons.add, size: 18, color: accent),
            label: Text(
              'Ajouter un palier',
              style: TextStyle(
                color: accent,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _TierCard extends StatefulWidget {
  const _TierCard({
    super.key,
    required this.index,
    required this.tier,
    required this.accentColor,
    required this.canDelete,
    required this.onUpdate,
    required this.onDelete,
  });

  final int index;
  final FeeTier tier;
  final Color accentColor;
  final bool canDelete;
  final ValueChanged<FeeTier> onUpdate;
  final VoidCallback onDelete;

  @override
  State<_TierCard> createState() => _TierCardState();
}

class _TierCardState extends State<_TierCard> {
  late final TextEditingController _labelCtrl;
  late final TextEditingController _amountCtrl;

  static const _fieldDecoration = InputDecoration(
    isDense: true,
    contentPadding: EdgeInsets.symmetric(
      horizontal: ViroSpacing.sm,
      vertical: ViroSpacing.sm + 2,
    ),
  );

  @override
  void initState() {
    super.initState();
    _labelCtrl = TextEditingController(text: widget.tier.label);
    _amountCtrl = TextEditingController(text: _amountText(widget.tier));
  }

  @override
  void didUpdateWidget(covariant _TierCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tier.tierId != widget.tier.tierId) {
      _labelCtrl.text = widget.tier.label;
      _amountCtrl.text = _amountText(widget.tier);
    }
  }

  String _amountText(FeeTier tier) {
    final euros = tier.amountCents / 100;
    return euros > 0 ? euros.toStringAsFixed(2).replaceAll('.', ',') : '';
  }

  @override
  void dispose() {
    _labelCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  void _emit() {
    final cents = parseAmountToCents(_amountCtrl.text) ?? 0;
    widget.onUpdate(
      widget.tier.copyWith(
        label: _labelCtrl.text.trim(),
        amountCents: cents,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: ViroColors.surfaceCard,
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
        border: Border.all(
          color: widget.accentColor.withValues(alpha: 0.35),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(ViroSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: widget.accentColor.withValues(alpha: 0.12),
                    borderRadius:
                        BorderRadius.circular(ViroSpacing.buttonRadius),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: ViroSpacing.sm,
                      vertical: ViroSpacing.xs,
                    ),
                    child: Text(
                      'Palier ${widget.index + 1}',
                      style: theme.labelSmall?.copyWith(
                        color: widget.accentColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                const Spacer(),
                if (widget.canDelete)
                  TextButton(
                    onPressed: widget.onDelete,
                    style: TextButton.styleFrom(
                      foregroundColor: ViroColors.error,
                      padding: const EdgeInsets.symmetric(
                        horizontal: ViroSpacing.sm,
                      ),
                      visualDensity: VisualDensity.compact,
                    ),
                    child: const Text('Supprimer'),
                  ),
              ],
            ),
            const SizedBox(height: ViroSpacing.sm),
            TextField(
              controller: _labelCtrl,
              textCapitalization: TextCapitalization.sentences,
              decoration: _fieldDecoration.copyWith(
                labelText: 'Libellé',
                hintText: 'U14, Senior, Licencié…',
              ),
              onChanged: (_) => _emit(),
            ),
            const SizedBox(height: ViroSpacing.sm),
            TextField(
              controller: _amountCtrl,
              decoration: _fieldDecoration.copyWith(
                labelText: 'Montant',
                suffixText: '€',
                hintText: '150,00',
              ),
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              onChanged: (_) => _emit(),
            ),
          ],
        ),
      ),
    );
  }
}
