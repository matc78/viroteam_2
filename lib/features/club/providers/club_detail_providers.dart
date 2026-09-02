import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/announcements/providers/announcement_providers.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/home/providers/member_events_provider.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';

class ClubEventsState {
  const ClubEventsState({
    required this.pending,
    required this.upcoming,
  });

  final List<ClubEvent> pending;
  final List<ClubEvent> upcoming;

  static const empty = ClubEventsState(pending: [], upcoming: []);
}

final clubProvider = FutureProvider.family<Club?, String>((ref, clubId) {
  return ref.read(clubServiceProvider).getClub(clubId);
});

/// Couleurs de marque résolues (uni ou bicolore).
final clubBrandColorsProvider =
    Provider.family<ClubBrandColors, String>((ref, clubId) {
  final club = ref.watch(clubProvider(clubId)).value;
  return resolveClubBrandColors(
    brandColorHex: club?.brandColorHex,
    clubId: clubId,
  );
});

/// Couleur d'accent du club (brandColorHex ou fallback stable).
final clubAccentColorProvider = Provider.family<Color, String>((ref, clubId) {
  return ref.watch(clubBrandColorsProvider(clubId)).memberZoneColor;
});

/// Accent zone membre (accès rapides, planning perso…).
final clubMemberAccentProvider = Provider.family<Color, String>((ref, clubId) {
  return ref.watch(clubBrandColorsProvider(clubId)).memberZoneColor;
});

/// Accent zone gestion (coach / admin).
final clubManagementAccentProvider =
    Provider.family<Color, String>((ref, clubId) {
  return ref.watch(clubBrandColorsProvider(clubId)).managementZoneColor;
});

/// Invalide les caches visuels club (couleur / logo) dans toute l'app.
void invalidateClubVisualCaches(WidgetRef ref, String clubId) {
  ref.invalidate(clubProvider(clubId));
  ref.invalidate(clubBrandColorsProvider(clubId));
  ref.invalidate(clubAccentColorProvider(clubId));
  ref.invalidate(clubMemberAccentProvider(clubId));
  ref.invalidate(clubManagementAccentProvider(clubId));
  ref.invalidate(userClubsProvider);
  ref.invalidate(userClubsWithEventsProvider);
  ref.invalidate(homeActiveAnnouncementsProvider);
  ref.invalidate(homeFeeRemindersProvider);
  ref.invalidate(memberEventsProvider);
}

final clubMemberProvider =
    StreamProvider.family<ClubMember?, String>((ref, clubId) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value(null);
  // Parent sans fiche : `members/{uid}` n'existe pas et n'est pas lisible.
  if (ref.watch(isGuardianOnlyInClubProvider(clubId))) {
    return Stream.value(null);
  }
  return ref.read(eventServiceProvider).watchClubMember(
        clubId: clubId,
        uid: auth.uid,
      );
});

/// Events du club — dérivé du planning global ([memberEventsProvider]).
final clubEventsProvider =
    Provider.family<AsyncValue<ClubEventsState>, String>((ref, clubId) {
  return ref.watch(memberEventsProvider).when(
        data: (state) => AsyncValue.data(
          ClubEventsState(
            pending: state.pending.where((e) => e.clubId == clubId).toList(),
            upcoming: state.upcoming.where((e) => e.clubId == clubId).toList(),
          ),
        ),
        loading: () => const AsyncValue.loading(),
        error: (e, st) => AsyncValue.error(e, st),
      );
});

final clubAttendanceRateProvider =
    FutureProvider.family<double?, String>((ref, clubId) async {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return null;
  // Pas de taux de présence pour un parent (lecture `teamMemberIds` refusée).
  if (ref.watch(isGuardianOnlyInClubProvider(clubId))) return null;
  return ref.read(eventServiceProvider).computeAttendanceRate(
        clubId: clubId,
        authUid: auth.uid,
      );
});

/// Planning d’une fiche cible (enfant) — pas de fusion avec le calendrier sénior.
final clubEventsForMemberProvider = StreamProvider.family<ClubEventsState,
    ({String clubId, String memberId})>((ref, params) {
  final auth = ref.watch(firestoreAuthReadyProvider).value;
  if (auth == null) return Stream.value(ClubEventsState.empty);
  final eventService = ref.read(eventServiceProvider);

  // Parent : uniquement les événements des équipes de l'enfant (rules).
  final Stream<List<ClubEvent>> eventsStream;
  if (ref.watch(isGuardianOnlyInClubProvider(params.clubId))) {
    final guardianService = ref.read(guardianServiceProvider);
    eventsStream = Stream.fromFuture(
      guardianService.getClubMember(
        clubId: params.clubId,
        memberId: params.memberId,
      ),
    ).asyncExpand(
      (child) => eventService.watchUpcomingEventsForGuardian(
        clubId: params.clubId,
        childTeamIds: child?.teamIds ?? const [],
      ),
    );
  } else {
    eventsStream = eventService.watchEventsForTargetMember(
      clubId: params.clubId,
      memberId: params.memberId,
    );
  }

  return eventsStream
      .map(
        (events) => categorizeMemberEvents(
          events,
          authUid: params.memberId,
          audienceByClub: {params.clubId: params.memberId},
        ),
      )
      .map(
        (state) => ClubEventsState(
          pending: state.pending,
          upcoming: state.upcoming,
        ),
      );
});
