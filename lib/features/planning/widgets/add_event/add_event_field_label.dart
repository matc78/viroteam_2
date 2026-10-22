import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';

/// Décoration partagée des champs du formulaire nouvel événement ([palette] :
/// palette du thème courant, pour le fond et la bordure).
InputDecoration addEventInputDecoration({
  required ViroPalette palette,
  String? hint,
  String? label,
}) =>
    InputDecoration(
      hintText: hint,
      labelText: label,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.sm + 2,
      ),
      filled: true,
      fillColor: palette.surfaceCard,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
        borderSide: BorderSide(color: palette.accentSoft),
      ),
    );

/// Label de section au-dessus d’un champ (accent club).
class AddEventFieldLabel extends StatelessWidget {
  /// Affiche [text] avec la couleur d’accent du club.
  const AddEventFieldLabel(this.text, {super.key, this.accentColor});

  final String text;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.xs),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
              color: accentColor != null
                  ? context.viroPalette.readableAccent(accentColor!)
                  : context.viroPalette.brandText,
            ),
      ),
    );
  }
}
