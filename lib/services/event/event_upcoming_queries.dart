import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/services/event/event_date_helpers.dart';
import 'package:viro_team_v2/services/event/event_paths.dart';
import 'package:viro_team_v2/utils/stream_combine.dart';

/// Streams « planning à venir » (joueur, coach, parent, multi-clubs).
class EventUpcomingQueries {
  /// Crée le module de requêtes événements à venir.
  EventUpcomingQueries({
    required EventPaths paths,
    required this.watchClubMember,
    required this.rosterAudienceId,
  }) : _paths = paths;

  final EventPaths _paths;

  /// Stream fiche membre (délégation RSVP / accounts).
  final Stream<ClubMember?> Function({
    required String clubId,
    required String uid,
  }) watchClubMember;

  /// Clé roster pour un [ClubMember] authentifié.
  final String Function(ClubMember member, String authUid) rosterAudienceId;

  /// Événements à venir où [uid] (et optionnellement [alternateUid]) est convoqué.
  Stream<List<ClubEvent>> watchUpcomingEventsForClub({
    required String clubId,
    required String uid,
    String? alternateUid,
  }) {
    final lowerBound = EventDateHelpers.upcomingQueryLowerBound;
    final alt = alternateUid;
    final streams = <Stream<List<ClubEvent>>>[
      _watchUpcomingEventsForClubAudience(
        clubId: clubId,
        uid: uid,
        lowerBound: lowerBound,
      ),
      if (alt != null && alt.isNotEmpty && alt != uid)
        _watchUpcomingEventsForClubAudience(
          clubId: clubId,
          uid: alt,
          lowerBound: lowerBound,
        ),
    ];

    return combineLatestListStreams(streams)
        .map(EventDateHelpers.dedupeEvents);
  }

  Stream<List<ClubEvent>> _watchUpcomingEventsForClubAudience({
    required String clubId,
    required String uid,
    required Timestamp lowerBound,
  }) {
    return _paths
        .events(clubId)
        .where(FirestoreFields.teamMemberIds, arrayContains: uid)
        .where(FirestoreFields.date, isGreaterThanOrEqualTo: lowerBound)
        .orderBy(FirestoreFields.date)
        .snapshots()
        .map(
          (snap) => EventDateHelpers.sortedByDate(
            EventDateHelpers.filterUpcomingWindow(
              snap.docs.map(
                (d) => ClubEvent.fromFirestore(clubId: clubId, doc: d),
              ),
            ),
          ),
        );
  }

  /// Événements des équipes où [authUid] est coach (hors convocation joueur).
  Stream<List<ClubEvent>> watchUpcomingEventsAsCoach({
    required String clubId,
    required String authUid,
  }) {
    return _paths
        .teams(clubId)
        .where(FirestoreFields.coachIds, arrayContains: authUid)
        .snapshots()
        .asyncExpand((teamsSnap) {
      final teamIds = teamsSnap.docs.map((d) => d.id).toList();
      if (teamIds.isEmpty) return Stream.value(<ClubEvent>[]);

      final lowerBound = EventDateHelpers.upcomingQueryLowerBound;
      final streams = teamIds.map((teamId) {
        return _paths
            .events(clubId)
            .where(FirestoreFields.teamIds, arrayContains: teamId)
            .where(
              FirestoreFields.date,
              isGreaterThanOrEqualTo: lowerBound,
            )
            .orderBy(FirestoreFields.date)
            .snapshots()
            .map(
              (snap) => EventDateHelpers.sortedByDate(
                EventDateHelpers.filterUpcomingWindow(
                  snap.docs.map(
                    (d) => ClubEvent.fromFirestore(clubId: clubId, doc: d),
                  ),
                ),
              ),
            );
      }).toList();

      return combineLatestListStreams(streams)
          .map(EventDateHelpers.dedupeEvents);
    });
  }

  /// Joueur convoqué + entraînements des équipes coachées.
  Stream<List<ClubEvent>> watchUpcomingEventsForClubMember({
    required String clubId,
    required String audienceId,
    required String authUid,
  }) {
    final asPlayer = watchUpcomingEventsForClub(
      clubId: clubId,
      uid: audienceId,
      alternateUid: authUid,
    );
    final asCoach =
        watchUpcomingEventsAsCoach(clubId: clubId, authUid: authUid);
    final asTeamPlayer = watchUpcomingEventsForPlayerTeams(
      clubId: clubId,
      audienceId: audienceId,
      authUid: authUid,
    );

    return combineLatestListStreams([asPlayer, asCoach, asTeamPlayer])
        .map(EventDateHelpers.dedupeEvents);
  }

  /// Événements des équipes du joueur (compat. v1 : `teamIds` / `teamName`).
  Stream<List<ClubEvent>> watchUpcomingEventsForPlayerTeams({
    required String clubId,
    required String audienceId,
    required String authUid,
  }) {
    return _paths.teams(clubId).snapshots().asyncExpand((teamsSnap) {
      final playerTeamIds = <String>[];
      final playerTeamNames = <String>{};

      for (final doc in teamsSnap.docs) {
        final data = doc.data();
        final playerIds =
            (data[FirestoreFields.playerIds] as List<dynamic>?)
                    ?.whereType<String>() ??
                [];
        if (playerIds.contains(audienceId) || playerIds.contains(authUid)) {
          playerTeamIds.add(doc.id);
          final name = data[FirestoreFields.name] as String?;
          if (name != null && name.isNotEmpty) playerTeamNames.add(name);
        }
      }

      if (playerTeamIds.isEmpty) return Stream.value(<ClubEvent>[]);

      final lowerBound = EventDateHelpers.upcomingQueryLowerBound;
      final streams = <Stream<List<ClubEvent>>>[];

      for (final teamId in playerTeamIds) {
        streams.add(
          _paths
              .events(clubId)
              .where(FirestoreFields.teamIds, arrayContains: teamId)
              .where(FirestoreFields.date, isGreaterThanOrEqualTo: lowerBound)
              .orderBy(FirestoreFields.date)
              .snapshots()
              .map(
                (snap) => EventDateHelpers.sortedByDate(
                  EventDateHelpers.filterUpcomingWindow(
                    snap.docs.map(
                      (d) => ClubEvent.fromFirestore(clubId: clubId, doc: d),
                    ),
                  ),
                ),
              ),
        );
      }

      // Événements v1 sans `teamIds` mais avec `teamName`.
      if (playerTeamNames.isNotEmpty) {
        streams.add(
          _paths
              .events(clubId)
              .where(FirestoreFields.date, isGreaterThanOrEqualTo: lowerBound)
              .orderBy(FirestoreFields.date)
              .snapshots()
              .map(
                (snap) => EventDateHelpers.sortedByDate(
                  EventDateHelpers.filterUpcomingWindow(
                    snap.docs.where((doc) {
                      final data = doc.data();
                      final teamIds =
                          (data[FirestoreFields.teamIds] as List<dynamic>?)
                                  ?.whereType<String>() ??
                              [];
                      if (teamIds.isNotEmpty) return false;
                      final legacyName = data['teamName'] as String?;
                      if (legacyName == null ||
                          !playerTeamNames.contains(legacyName)) {
                        return false;
                      }
                      return true;
                    }).map(
                      (d) => ClubEvent.fromFirestore(clubId: clubId, doc: d),
                    ),
                  ),
                ),
              ),
        );
      }

      return combineLatestListStreams(streams)
          .map(EventDateHelpers.dedupeEvents);
    });
  }

  /// Événements à venir d'une équipe (`teamIds array-contains teamId`).
  ///
  /// Seule requête lisible par un parent : les rules exigent que
  /// `event.teamIds` croise `users/{uid}.parentTeamIds`.
  Stream<List<ClubEvent>> _watchUpcomingEventsForTeam({
    required String clubId,
    required String teamId,
    required Timestamp lowerBound,
  }) {
    return _paths
        .events(clubId)
        .where(FirestoreFields.teamIds, arrayContains: teamId)
        .where(FirestoreFields.date, isGreaterThanOrEqualTo: lowerBound)
        .orderBy(FirestoreFields.date)
        .snapshots()
        .map(
          (snap) => EventDateHelpers.sortedByDate(
            EventDateHelpers.filterUpcomingWindow(
              snap.docs.map(
                (d) => ClubEvent.fromFirestore(clubId: clubId, doc: d),
              ),
            ),
          ),
        );
  }

  /// Événements à venir visibles par un parent : uniquement ceux des équipes
  /// de l'enfant ([childTeamIds] = `members/{child}.teamIds`), une requête
  /// par équipe. Pas de lecture globale ni de fallback v1 `teamName`.
  Stream<List<ClubEvent>> watchUpcomingEventsForGuardian({
    required String clubId,
    required List<String> childTeamIds,
  }) {
    final teamIds = childTeamIds.where((id) => id.isNotEmpty).toSet();
    if (teamIds.isEmpty) return Stream.value(<ClubEvent>[]);

    final lowerBound = EventDateHelpers.upcomingQueryLowerBound;
    final streams = teamIds
        .map(
          (teamId) => _watchUpcomingEventsForTeam(
            clubId: clubId,
            teamId: teamId,
            lowerBound: lowerBound,
          ),
        )
        .toList();
    return combineLatestListStreams(streams)
        .map(EventDateHelpers.dedupeEvents);
  }

  /// Convocation d’une fiche cible uniquement (pas de fusion coach / séniors).
  Stream<List<ClubEvent>> watchEventsForTargetMember({
    required String clubId,
    required String memberId,
  }) {
    final asPlayer = watchUpcomingEventsForClub(
      clubId: clubId,
      uid: memberId,
    );
    final asTeamPlayer = watchUpcomingEventsForPlayerTeams(
      clubId: clubId,
      audienceId: memberId,
      authUid: memberId,
    );
    return combineLatestListStreams([asPlayer, asTeamPlayer])
        .map(EventDateHelpers.dedupeEvents);
  }

  /// Événements à venir pour un membre, tous ses clubs (spec home globale).
  Stream<List<ClubEvent>> watchUpcomingEventsForUser({
    required List<String> clubIds,
    required String authUid,
  }) {
    if (clubIds.isEmpty) return Stream.value([]);

    final audienceStreams = clubIds.map((clubId) {
      return watchClubMember(clubId: clubId, uid: authUid).map(
        (member) => [
          MapEntry(
            clubId,
            member == null ? authUid : rosterAudienceId(member, authUid),
          ),
        ],
      );
    }).toList();

    return combineLatestListStreams(audienceStreams).asyncExpand((entries) {
      final audienceByClub = Map<String, String>.fromEntries(entries);

      final eventStreams = clubIds.map((clubId) {
        final audienceId = audienceByClub[clubId] ?? authUid;
        return watchUpcomingEventsForClubMember(
          clubId: clubId,
          audienceId: audienceId,
          authUid: authUid,
        );
      }).toList();

      return combineLatestListStreams(eventStreams)
          .map(EventDateHelpers.dedupeEvents);
    });
  }
}
