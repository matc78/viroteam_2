import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Ligne « icône d'accent + texte » des pré-demandes (notifs, mesure
/// d'audience). Icône décorative : le texte porte le sens.
class ViroBenefitRow extends StatelessWidget {
  const ViroBenefitRow({super.key, required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Row(
      children: [
        ViroIcon(icon, size: 20, color: palette.accent),
        const SizedBox(width: ViroSpacing.sm),
        Expanded(
          child: Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: palette.textPrimary),
          ),
        ),
      ],
    );
  }
}
