import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/club/models/club_activity_event.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

/// Journal d’activité du club (temps réel, plus récent d’abord).
final clubActivityProvider =
    StreamProvider.autoDispose.family<List<ClubActivityEvent>, String>(
  (ref, clubId) {
    return ref
        .watch(clubActivityServiceProvider)
        .watchActivity(clubId: clubId);
  },
);
