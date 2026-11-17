import 'package:flutter/material.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Propose d'ouvrir les paramètres du club, où se règlent les capacités de
/// tous les coachs (tap sur une capacité d'équipe dans la feuille des
/// droits).
///
/// [discardUnsavedChanges] : le corps prévient que le brouillon de la
/// feuille sera perdu. Retourne `true` si l'utilisateur choisit « Go ».
Future<bool> showCoachRightsRedirectDialog(
  BuildContext context, {
  bool discardUnsavedChanges = false,
}) async {
  final copy = AppCopy.permissions;
  final go = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(copy.coachRightsRedirectTitle),
      content: Text(
        discardUnsavedChanges
            ? copy.coachRightsRedirectBodyUnsaved
            : copy.coachRightsRedirectBody,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: Text(copy.coachRightsRedirectNo),
        ),
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          child: Text(copy.coachRightsRedirectGo),
        ),
      ],
    ),
  );
  return go == true;
}
