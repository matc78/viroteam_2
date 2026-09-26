import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_motion.dart';

/// Transition slide opaque + parallaxe (WhatsApp / Messenger).
Widget buildViroSlideTransition({
  required Animation<double> animation,
  required Animation<double> secondaryAnimation,
  required Widget child,
}) {
  final enter = CurvedAnimation(
    parent: animation,
    curve: ViroMotion.enter,
    reverseCurve: ViroMotion.exit,
  );
  final secondary = CurvedAnimation(
    parent: secondaryAnimation,
    curve: ViroMotion.enter,
    reverseCurve: ViroMotion.exit,
  );

  final slideIn = Tween<Offset>(
    begin: const Offset(1, 0),
    end: Offset.zero,
  ).animate(enter);
  final slideUnder = Tween<Offset>(
    begin: Offset.zero,
    end: const Offset(-0.08, 0),
  ).animate(secondary);

  return SlideTransition(
    position: slideUnder,
    child: SlideTransition(
      position: slideIn,
      child: child,
    ),
  );
}

/// Page push style messagerie : slide opaque depuis la droite, parallaxe dessous.
///
/// Pas de fade (évite le flash « fantôme » à l’open, comme WhatsApp / Messenger).
///
/// [transitionDuration] à [Duration.zero] après un swipe interactif déjà terminé
/// (évite le double slide) ; le pop garde toujours la slide retour.
class ViroSlidePage<T> extends CustomTransitionPage<T> {
  ViroSlidePage({
    required super.child,
    super.name,
    super.arguments,
    super.restorationId,
    super.key,
    super.transitionDuration = ViroMotion.drillIn,
  }) : super(
          reverseTransitionDuration: ViroMotion.standard,
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return buildViroSlideTransition(
              animation: animation,
              secondaryAnimation: secondaryAnimation,
              child: child,
            );
          },
        );
}

/// Route [Navigator] avec la même transition que [ViroSlidePage].
class ViroSlideRoute<T> extends PageRouteBuilder<T> {
  ViroSlideRoute({
    required WidgetBuilder builder,
    super.settings,
  }) : super(
          transitionDuration: ViroMotion.drillIn,
          reverseTransitionDuration: ViroMotion.standard,
          pageBuilder: (context, animation, secondaryAnimation) =>
              builder(context),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return buildViroSlideTransition(
              animation: animation,
              secondaryAnimation: secondaryAnimation,
              child: child,
            );
          },
        );
}
