import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';

/// Ligne cochable de la feuille d'attribution des droits : un droit ou une
/// fonction (groupe de droits).
///
/// [value] `null` = état partiel (fonction dont une partie des droits est
/// cochée). [onChanged] `null` = ligne en lecture seule (droit déjà donné
/// par l'Administrateur, enregistrement en cours).
class MemberPermissionListTile extends StatelessWidget {
  const MemberPermissionListTile({
    super.key,
    required this.title,
    required this.value,
    required this.onChanged,
    this.subtitle,
    this.accentColor,
  });

  final String title;
  final String? subtitle;
  final bool? value;
  final ValueChanged<bool>? onChanged;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final changed = onChanged;
    return CheckboxListTile(
      value: value,
      tristate: value == null,
      onChanged: changed == null
          ? null
          // Partiel → coché : un tap complète la fonction (le cycle
          // tristate de Flutter passerait à « décoché »).
          : (next) => changed(value == null || (next ?? false)),
      activeColor: accentColor,
      controlAffinity: ListTileControlAffinity.trailing,
      contentPadding: EdgeInsets.zero,
      title: Text(title),
      subtitle: subtitle == null
          ? null
          : Text(
              subtitle!,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
    );
  }
}
