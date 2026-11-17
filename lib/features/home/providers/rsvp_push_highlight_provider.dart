import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/features/home/models/rsvp_push_highlight.dart';

/// Liseré des events de la home ouverts depuis une push RSVP : posé au tap,
/// effacé après [ViroMotion.rsvpHighlightDuration] ou au changement de page.
class RsvpPushHighlightNotifier extends Notifier<RsvpPushHighlight?> {
  Timer? _timer;

  @override
  RsvpPushHighlight? build() {
    ref.onDispose(() => _timer?.cancel());
    return null;
  }

  /// Pose un nouveau liseré (remplace celui en cours, compte à rebours compris).
  void set(RsvpPushHighlight highlight) {
    _timer?.cancel();
    _timer = null;
    state = highlight;
  }

  /// Lance le compte à rebours une fois les cartes affichées (sans effet s'il
  /// tourne déjà) : à froid, le chargement ne consomme pas la durée.
  void startCountdown() {
    if (state == null || _timer != null) return;
    _timer = Timer(ViroMotion.rsvpHighlightDuration, clear);
  }

  /// Retire le liseré.
  void clear() {
    _timer?.cancel();
    _timer = null;
    if (state != null) state = null;
  }
}

final rsvpPushHighlightProvider =
    NotifierProvider<RsvpPushHighlightNotifier, RsvpPushHighlight?>(
  RsvpPushHighlightNotifier.new,
);
