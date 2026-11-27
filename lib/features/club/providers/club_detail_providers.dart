import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/announcements/providers/announcement_providers.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_attendance_providers.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/home/providers/member_events_provider.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/attendance/attendance_stats.dart';
import 'package:viro_team_v2/utils/stream_switch_map.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';

class ClubEventsState {
  const ClubEventsState({
    required this.pending,
    required this.upcoming,
  });

  final List<ClubEvent> pending;
  final List<ClubEvent> upcoming;

  static const empty = ClubEventsState(pending: [], upcoming: []);
}

/// Document club en temps réel (réglages coach compris : une modification de
/// `coachPermissions` se reflète aussitôt dans [clubAccessProvider]).
final clubProvider = StreamProvider.family<Club?, String>((ref, clubId) {
  return ref.read(clubServiceProvider).watchClub(clubId);
});

/// Couleurs de marque résolues (uni ou bicolore).
///
/// Tant que [clubProvider] n'a pas répondu, on réutilise le `brandColorHex`
/// déjà connu via [userClubsProvider] (ex. cartes de l'accueil) pour éviter
/// le fallback preset hashé — souvent rouge — sur les titres / heures du
/// détail d'événement ouvert juste après le cold start.
final clubBrandColorsProvider =
    Provider.family<ClubBrandColors, String>((ref, clubId) {
  final club = ref.watch(clubProvider(clubId)).value;
  final brandColorHex = club?.brandColorHex ??
      _brandColorHexFromUserClubs(ref.watch(userClubsProvider).value, clubId);
  return resolveClubBrandColors(
    brandColorHex: brandColorHex,
    clubId: clubId,
  );
});

/// Hex de marque du club dans la liste session, ou `null` si inconnu / hors liste.
String? _brandColorHexFromUserClubs(List<UserClubEntry>? entries, String clubId) {
  if (entries == null) return null;
  for (final entry in entries) {
    if (entry.club.id == clubId) return entry.club.brandColorHex;
  }
  return null;
}

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
        memberId: auth.uid,
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

/// Pastille « % de oui » de l’en-tête club : même taux 30 j que la page
/// Présences / le portail (`summarizeAttendance`, joueurs des effectifs),
/// réservé à l’encadrement ([ClubAccess.canViewAttendance]).
final clubAttendanceRateProvider =
    FutureProvider.family<int?, String>((ref, clubId) async {
  final access = ref.watch(clubAccessProvider(clubId));
  if (!access.canViewAttendance) return null;
  final view = await ref.watch(
    clubAttendanceProvider((
      clubId: clubId,
      period: AttendancePeriod.last30Days,
    )).future,
  );
  return view.summary.rate;
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
    ).switchMap(
      (child) => eventService.watchUpcomingEventsForGuardian(
        clubId: params.clubId,
        childTeamIds: child?.teamIds ?? const [],
        childMemberId: child?.memberId,
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
        (events) => categorizeMemberEvents(events, memberId: params.memberId),
      )
      .map(
        (state) => ClubEventsState(
          pending: state.pending,
          upcoming: state.upcoming,
        ),
      );
});
