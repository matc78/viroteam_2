import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/parent_link.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

/// Club accessible en session : adhésion et/ou liens parent actifs.
class UserClubEntry {
  const UserClubEntry({
    required this.club,
    this.isLicensed = false,
    this.parentLinks = const [],
  });

  final Club club;

  /// Fiche membre dans ce club (`users.memberClubIds`).
  final bool isLicensed;
  final List<ParentLink> parentLinks;

  /// Au moins un enfant suivi dans ce club.
  bool get hasFamilyLinks => parentLinks.isNotEmpty;
}

class UserClubWithEvent {
  const UserClubWithEvent({
    required this.club,
    this.isLicensed = false,
    this.parentLinks = const [],
    this.highlightEvent,
  });

  final Club club;

  /// Fiche membre dans ce club (`users.memberClubIds`).
  final bool isLicensed;
  final List<ParentLink> parentLinks;
  final ClubEvent? highlightEvent;
}

final userClubsProvider = FutureProvider<List<UserClubEntry>>((ref) async {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  final user = ref.watch(viroUserProvider).value;
  if (auth == null || user == null || !user.hasClubs) return [];

  final clubs = await ref.read(clubServiceProvider).getClubsForUser(user);
  final memberClubIds = user.memberClubIds.toSet();
  final linksByClub = <String, List<ParentLink>>{};
  for (final link in user.activeParentLinks) {
    linksByClub.putIfAbsent(link.clubId, () => []).add(link);
  }

  return clubs
      .map(
        (club) => UserClubEntry(
          club: club,
          isLicensed: memberClubIds.contains(club.id),
          parentLinks: linksByClub[club.id] ?? const [],
        ),
      )
      .toList();
});

final userClubsWithEventsProvider =
    FutureProvider<List<UserClubWithEvent>>((ref) async {
  final entries = await ref.watch(userClubsProvider.future);
  final user = ref.watch(viroUserProvider).value;
  final eventService = ref.read(eventServiceProvider);
  final guardianService = ref.read(guardianServiceProvider);

  return Future.wait(
    entries.map((entry) async {
      // Parent sans fiche : pas de lecture globale des events du club.
      final ClubEvent? event;
      if (!entry.isLicensed && entry.hasFamilyLinks && user != null) {
        final childTeamIds = await loadGuardianChildTeamIds(
          guardianService: guardianService,
          user: user,
          clubId: entry.club.id,
        );
        event = await eventService.getHighlightEventForGuardian(
          clubId: entry.club.id,
          childTeamIds: childTeamIds,
        );
      } else {
        event = await eventService.getHighlightEventForClub(entry.club.id);
      }
      return UserClubWithEvent(
        club: entry.club,
        isLicensed: entry.isLicensed,
        parentLinks: entry.parentLinks,
        highlightEvent: event,
      );
    }),
  );
});
