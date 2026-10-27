import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Demande confirmation avant de retirer [memberName] du roster de [teamName].
///
/// Retourne `true` uniquement si l’utilisateur confirme (action en rouge).
Future<bool> showConfirmRemoveFromTeamDialog(
  BuildContext context, {
  required String memberName,
  required String teamName,
}) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(AppCopy.teams.removeFromTeamTitle),
      content: Text(
        AppCopy.teams.removeFromTeamBody(
          memberName: memberName,
          teamName: teamName,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: Text(AppCopy.common.cancel),
        ),
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          child: Text(
            AppCopy.teams.removeFromTeamAction,
            style: TextStyle(color: dialogContext.viroPalette.errorText),
          ),
        ),
      ],
    ),
  );
  return confirmed == true;
}
