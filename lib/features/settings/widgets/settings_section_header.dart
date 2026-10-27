import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Titre (et sous-titre optionnel) d'un bloc de paramètres.
///
/// [color] remplace la couleur du titre (ex. rouge pour la zone sensible).
class SettingsSectionHeader extends StatelessWidget {
  const SettingsSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.color,
  });

  final String title;
  final String? subtitle;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.titleSmall?.copyWith(
              color: color ?? palette.brandText,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: ViroSpacing.xs),
            Text(
              subtitle!,
              style: theme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}
