import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Retour arrière tolérant à une pile vide.
///
/// Un écran ouvert par deep link (notif, lien d'invitation) est souvent seul
/// dans la pile go_router : `pop` n'a rien à dépiler. On remonte alors vers
/// [fallbackRoute], l'écran parent logique (ex. planning → fiche club).
void popOrGo(BuildContext context, String fallbackRoute) {
  if (context.canPop()) {
    context.pop();
  } else {
    context.go(fallbackRoute);
  }
}
