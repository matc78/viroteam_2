import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/home/models/rsvp_push_highlight.dart';
import 'package:viro_team_v2/features/home/providers/rsvp_push_highlight_provider.dart';

/// Positions hors écran des events encadrés (push RSVP) sur la home.
@immutable
class RsvpHighlightOffscreenHints {
  const RsvpHighlightOffscreenHints({
    required this.up,
    required this.down,
  });

  static const none = RsvpHighlightOffscreenHints(up: false, down: false);

  /// Au moins un event encadré est entièrement au-dessus du viewport.
  final bool up;

  /// Au moins un event encadré est entièrement en dessous du viewport.
  final bool down;

  bool get isEmpty => !up && !down;

  @override
  bool operator ==(Object other) =>
      other is RsvpHighlightOffscreenHints &&
      other.up == up &&
      other.down == down;

  @override
  int get hashCode => Object.hash(up, down);
}

class _OffscreenEntry {
  _OffscreenEntry({required this.side, required this.reveal});

  RsvpHighlightOffscreenSide side;
  VoidCallback reveal;
}

/// Agrège les tuiles RSVP hors viewport pour afficher les flèches de scroll.
class RsvpHighlightOffscreenNotifier
    extends Notifier<RsvpHighlightOffscreenHints> {
  final Map<String, _OffscreenEntry> _entries = {};

  @override
  RsvpHighlightOffscreenHints build() {
    ref.listen(rsvpPushHighlightProvider, (_, next) {
      if (next == null) clear();
    });
    return RsvpHighlightOffscreenHints.none;
  }

  /// Enregistre qu'un event [eventKey] est hors écran ([side]) ou à l'écran
  /// ([side] null). [reveal] fait défiler jusqu'à la tuile.
  void report(
    String eventKey,
    RsvpHighlightOffscreenSide? side, {
    VoidCallback? reveal,
  }) {
    if (side == null || reveal == null) {
      if (_entries.remove(eventKey) != null) _emit();
      return;
    }
    final existing = _entries[eventKey];
    if (existing != null && existing.side == side) {
      existing.reveal = reveal;
      return;
    }
    _entries[eventKey] = _OffscreenEntry(side: side, reveal: reveal);
    _emit();
  }

  /// Fait défiler vers le premier event hors écran du côté [side].
  void reveal(RsvpHighlightOffscreenSide side) {
    for (final entry in _entries.values) {
      if (entry.side != side) continue;
      entry.reveal();
      return;
    }
  }

  /// Retire toutes les entrées (fin du liseré).
  void clear() {
    if (_entries.isEmpty) return;
    _entries.clear();
    state = RsvpHighlightOffscreenHints.none;
  }

  void _emit() {
    var up = false;
    var down = false;
    for (final entry in _entries.values) {
      switch (entry.side) {
        case RsvpHighlightOffscreenSide.up:
          up = true;
        case RsvpHighlightOffscreenSide.down:
          down = true;
      }
      if (up && down) break;
    }
    final next = RsvpHighlightOffscreenHints(up: up, down: down);
    if (state.up == next.up && state.down == next.down) return;
    state = next;
  }
}

final rsvpHighlightOffscreenProvider = NotifierProvider<
    RsvpHighlightOffscreenNotifier, RsvpHighlightOffscreenHints>(
  RsvpHighlightOffscreenNotifier.new,
);
