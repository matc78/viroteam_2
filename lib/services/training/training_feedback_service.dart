import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/services/event/event_date_helpers.dart';
import 'package:viro_team_v2/services/training/training_paths.dart';
import 'package:viro_team_v2/utils/calendar_days.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';
import 'package:viro_team_v2/utils/stream_combine.dart';

/// Retours de séance : brouillon du coach, envoi (callable
/// `sendTrainingFeedback`), lecture des retours et messages perso.
class TrainingFeedbackService {
  /// Crée le service (Firestore app + Functions europe-west1).
  TrainingFeedbackService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  }) : _paths = TrainingPaths(firestore ?? appFirestore),
       _functions =
           functions ?? FirebaseFunctions.instanceFor(region: 'europe-west1');

  final TrainingPaths _paths;
  final FirebaseFunctions _functions;

  /// Valeurs max d'un filtre `arrayContainsAny` (limite Firestore).
  static const int _maxArrayContainsAny = 30;

  /// Entraînements passés (ou du jour) des équipes [teamIds], du plus récent
  /// au plus ancien, au plus [limit]. Une requête par lot de 30 équipes
  /// (limite de `arrayContainsAny`), une seule en pratique.
  Stream<List<ClubEvent>> watchPastTrainings({
    required String clubId,
    required List<String> teamIds,
    required int limit,
  }) {
    if (teamIds.isEmpty) return Stream.value(const []);
    final today = EventDateHelpers.startOfToday();
    // Marge d'un jour : les dates sont stockées à minuit UTC.
    final upperBound = Timestamp.fromDate(addCalendarDays(today, 2));
    final streams =
        [
          for (
            var start = 0;
            start < teamIds.length;
            start += _maxArrayContainsAny
          )
            teamIds.sublist(
              start,
              min(start + _maxArrayContainsAny, teamIds.length),
            ),
        ].map((teamIdsChunk) {
          return _paths
              .events(clubId)
              .where(FirestoreFields.teamIds, arrayContainsAny: teamIdsChunk)
              .where(FirestoreFields.type, isEqualTo: EventTypes.training)
              .where(FirestoreFields.date, isLessThan: upperBound)
              .orderBy(FirestoreFields.date, descending: true)
              .limit(limit)
              .snapshots()
              .map(
                (snap) => snap.docs
                    .map((d) => ClubEvent.fromFirestore(clubId: clubId, doc: d))
                    .toList(),
              );
        }).toList();

    return combineLatestListStreams(streams).map((events) {
      final byId = {for (final e in events) e.id: e};
      final past =
          byId.values
              .where(
                (e) => !e.canceled && !e.allTeams && !e.date.isAfter(today),
              )
              .toList()
            ..sort((a, b) => b.date.compareTo(a.date));
      return past.take(limit).toList();
    });
  }

  /// Entraînement [eventId] en direct (`null` s'il n'existe plus).
  Stream<ClubEvent?> watchEvent({
    required String clubId,
    required String eventId,
  }) => _paths
      .event(clubId, eventId)
      .snapshots()
      .map(
        (snap) => snap.exists
            ? ClubEvent.fromFirestore(clubId: clubId, doc: snap)
            : null,
      );

  /// Brouillon de [coachUid] (`null` s'il n'existe pas).
  Future<TrainingFeedbackDraft?> getDraft({
    required String clubId,
    required String eventId,
    required String coachUid,
  }) async {
    final snap = await _paths.draft(clubId, eventId, coachUid).get();
    return TrainingFeedbackDraft.fromFirestore(snap);
  }

  /// Enregistre le brouillon de [coachUid] (écrase le précédent).
  Future<void> saveDraft({
    required String clubId,
    required String eventId,
    required String coachUid,
    required TrainingFeedbackDraft draft,
  }) => _paths.draft(clubId, eventId, coachUid).set(draft.toFirestore());

  /// Retours envoyés sur l'entraînement (un par coach).
  Stream<List<TrainingFeedback>> watchFeedbacks({
    required String clubId,
    required String eventId,
  }) => _paths
      .feedbacks(clubId, eventId)
      .snapshots()
      .map(
        (snap) =>
            snap.docs.map(TrainingFeedback.fromFirestore).toList()
              ..sort((a, b) => a.coachName.compareTo(b.coachName)),
      );

  /// Messages perso envoyés par [coachUid] (coachs de la séance et admin).
  Stream<List<TrainingPlayerMessage>> watchCoachMessages({
    required String clubId,
    required String eventId,
    required String coachUid,
  }) => _paths
      .playerMessages(clubId, eventId, coachUid)
      .snapshots()
      .map(
        (snap) => snap.docs.map(TrainingPlayerMessage.fromFirestore).toList(),
      );

  /// Messages perso reçus par [memberId] (soi ou enfant), un par coach
  /// parmi [coachUids]. Lecture par id : seul accès permis au joueur.
  Stream<List<TrainingPlayerMessage>> watchMessagesForMember({
    required String clubId,
    required String eventId,
    required List<String> coachUids,
    required String memberId,
  }) {
    if (coachUids.isEmpty) return Stream.value(const []);
    final streams = coachUids.map((coachUid) {
      return _paths
          .playerMessages(clubId, eventId, coachUid)
          .doc(memberId)
          .snapshots()
          .map(
            (snap) => snap.exists
                ? [TrainingPlayerMessage.fromFirestore(snap)]
                : const <TrainingPlayerMessage>[],
          );
    }).toList();
    return combineLatestListStreams(streams);
  }

  /// Envoie le retour (notes collectives, mot au collectif, messages perso
  /// de [playerMessages]). Le brouillon est supprimé côté serveur.
  Future<void> send({
    required String clubId,
    required String eventId,
    required double levelRating,
    required double engagementRating,
    required String collectiveMessage,
    required Map<String, String> playerMessages,
  }) async {
    await _functions
        .httpsCallable(cloudCallableName('sendTrainingFeedback'))
        .call(<String, dynamic>{
          'clubId': clubId,
          'eventId': eventId,
          'levelRating': levelRating,
          'engagementRating': engagementRating,
          'collectiveMessage': collectiveMessage.trim(),
          'playerMessages': playerMessages,
        });
  }

  /// États perso de [uid] sur les entraînements de [clubId] (flemme,
  /// retours lus), indexés par id d'événement.
  Stream<Map<String, TrainingFeedbackUserState>> watchUserStates({
    required String uid,
    required String clubId,
  }) => _paths
      .userStates(uid)
      .where(FirestoreFields.clubId, isEqualTo: clubId)
      .snapshots()
      .map(
        (snap) => {
          for (final state in snap.docs.map(
            TrainingFeedbackUserState.fromFirestore,
          ))
            state.eventId: state,
        },
      );

  /// Marque (ou démarque) l'entraînement [eventId] en « flemme » pour le
  /// coach [uid] : la séance sort de ses rappels.
  Future<void> setSkipped({
    required String uid,
    required String clubId,
    required String eventId,
    required bool skipped,
  }) => _paths
      .userStates(uid)
      .doc(TrainingFeedbackUserState.docId(clubId, eventId))
      .set({
        FirestoreFields.clubId: clubId,
        FirestoreFields.eventId: eventId,
        FirestoreFields.skipped: skipped,
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

  /// Note que [uid] a lu les retours de [coachUids] adressés à [memberId]
  /// (soi ou enfant) sur l'entraînement [eventId].
  Future<void> markSeen({
    required String uid,
    required String clubId,
    required String eventId,
    required String memberId,
    required List<String> coachUids,
  }) => _paths
      .userStates(uid)
      .doc(TrainingFeedbackUserState.docId(clubId, eventId))
      .set({
        FirestoreFields.clubId: clubId,
        FirestoreFields.eventId: eventId,
        FirestoreFields.seen: {memberId: FieldValue.arrayUnion(coachUids)},
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
}
