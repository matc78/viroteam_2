import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/config/viro_standings.dart';

/// Titre de section de la saison d'équipe (« Parcours », « À venir »…).
class StandingsSectionTitle extends StatelessWidget {
  const StandingsSectionTitle({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Padding(
      padding: const EdgeInsets.only(
        top: ViroSpacing.lg,
        bottom: ViroSpacing.sm,
      ),
      child: Semantics(
        header: true,
        child: Row(
          children: [
            Container(
              width: ViroStandings.sectionBarWidth,
              height: ViroStandings.sectionBarHeight,
              decoration: BoxDecoration(
                color: palette.accent,
                borderRadius: BorderRadius.circular(
                  ViroStandings.sectionBarRadius,
                ),
              ),
            ),
            const SizedBox(width: ViroSpacing.sm),
            Flexible(
              child: Text(
                label,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: palette.brandText,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Ligne d'aide discrète sous un titre de section (liste vide).
class StandingsSectionHint extends StatelessWidget {
  const StandingsSectionHint({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: Theme.of(
        context,
      ).textTheme.bodySmall?.copyWith(color: context.viroPalette.textSecondary),
    );
  }
}
