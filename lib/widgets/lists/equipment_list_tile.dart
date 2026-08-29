import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/models/club_equipment.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Tuile inventaire équipement (liste admin).
class EquipmentListTile extends StatelessWidget {
  const EquipmentListTile({
    super.key,
    required this.item,
    required this.teamLabel,
    required this.accentColor,
    this.onTap,
    this.onDelete,
  });

  final ClubEquipmentItem item;
  final String? teamLabel;
  final Color accentColor;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final subtitleParts = <String>[
      item.category,
      '×${item.quantity}',
      equipmentConditionLabel(item.condition),
      if (item.location.isNotEmpty) item.location,
      if (teamLabel != null) teamLabel!,
    ];

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        accentColor: accentColor,
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm,
        ),
        child: Row(
          children: [
            Expanded(
              child: ViroPressable(
                onTap: onTap,
                borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      style: theme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: accentColor,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitleParts.join(' · '),
                      style: theme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
                      ),
                    ),
                    if (item.notes.isNotEmpty)
                      Text(
                        item.notes,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.bodySmall?.copyWith(
                          color: ViroColors.gray600,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (onDelete != null)
              IconButton(
                icon: ViroIcon(ViroIcons.trash, color: ViroColors.error),
                tooltip: 'Supprimer',
                onPressed: onDelete,
              ),
          ],
        ),
      ),
    );
  }
}
