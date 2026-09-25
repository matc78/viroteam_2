import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Ligne cliquable label + valeur (date / heure), sans hauteur ListTile.
class AddEventPickValueRow extends StatelessWidget {
  /// Construit une ligne pressable label / valeur pour le formulaire événement.
  const AddEventPickValueRow({
    super.key,
    required this.label,
    required this.value,
    required this.valueStyle,
    required this.accentColor,
    this.subtitle,
    this.trailing,
    this.expand = true,
    this.onTap,
  });

  final String label;
  final String value;
  final TextStyle? valueStyle;
  final Color accentColor;
  final String? subtitle;
  final Widget? trailing;
  final bool expand;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final labelColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: accentColor,
              ),
        ),
        const SizedBox(height: ViroSpacing.xs),
        Text(value, style: valueStyle),
        if (subtitle != null) ...[
          const SizedBox(height: ViroSpacing.xs),
          Text(
            subtitle!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: ViroColors.primary600,
                ),
          ),
        ],
      ],
    );

    return ViroPressable(
      onTap: onTap,
      enabled: onTap != null,
      floating: false,
      borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: ViroSpacing.sm),
        child: Row(
          mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (expand) Expanded(child: labelColumn) else labelColumn,
            ?trailing,
          ],
        ),
      ),
    );
  }
}
