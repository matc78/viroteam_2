import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Titre de section de la saison d'équipe (« Parcours », « À venir »…).
class StandingsSectionTitle extends StatelessWidget {
  const StandingsSectionTitle({
    super.key,
    required this.label,
    this.centered = false,
  });

  final String label;
  final bool centered;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        top: ViroSpacing.lg,
        bottom: ViroSpacing.sm,
      ),
      child: Semantics(
        header: true,
        child: Text(
          label,
          textAlign: centered ? TextAlign.center : TextAlign.start,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w800,
            color: context.viroPalette.brandText,
          ),
        ),
      ),
    );
  }
}

/// Ligne d'aide discrète sous un titre de section (liste vide).
class StandingsSectionHint extends StatelessWidget {
  const StandingsSectionHint({
    super.key,
    required this.label,
    this.centered = false,
  });

  final String label;
  final bool centered;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      textAlign: centered ? TextAlign.center : TextAlign.start,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        color: context.viroPalette.textSecondary,
      ),
    );
  }
}
