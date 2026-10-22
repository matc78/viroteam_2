import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:viro_team_v2/config/project_config.dart';

/// Appelle [onSeen] une fois que [child] est resté visible au moins
/// [ProjectConfig.eventSeenVisibleFraction] pendant [ProjectConfig.eventSeenDwell].
class EventSeenVisibilityTracker extends StatefulWidget {
  /// [trackingKey] doit être unique à l'écran (ex. `clubId/eventId`).
  const EventSeenVisibilityTracker({
    super.key,
    required this.trackingKey,
    required this.onSeen,
    required this.child,
  });

  final String trackingKey;
  final VoidCallback onSeen;
  final Widget child;

  @override
  State<EventSeenVisibilityTracker> createState() =>
      _EventSeenVisibilityTrackerState();
}

class _EventSeenVisibilityTrackerState
    extends State<EventSeenVisibilityTracker> {
  Timer? _dwellTimer;
  bool _reported = false;

  void _onVisibilityChanged(VisibilityInfo info) {
    if (_reported) return;
    if (info.visibleFraction >= ProjectConfig.eventSeenVisibleFraction) {
      _dwellTimer ??= Timer(ProjectConfig.eventSeenDwell, () {
        if (!mounted) return;
        _reported = true;
        widget.onSeen();
      });
    } else {
      _dwellTimer?.cancel();
      _dwellTimer = null;
    }
  }

  @override
  void dispose() {
    _dwellTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => VisibilityDetector(
        key: ValueKey('event-seen-${widget.trackingKey}'),
        onVisibilityChanged: _onVisibilityChanged,
        child: widget.child,
      );
}
