import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/services/event/event_date_helpers.dart';
import 'package:viro_team_v2/services/event/event_paths.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';

/// RSVP, fiche membre et stats de présence.
class EventRsvpOperations {
  /// Crée le module RSVP / audience.
  EventRsvpOperations({
    required EventPaths paths,
    required FirebaseFunctions functions,
  })  : _paths = paths,
        _functions = functions;

  final EventPaths _paths;
  final FirebaseFunctions _functions;

  /// Maps d'un event indexées par `memberId`, nettoyées au retrait du membre.
  static const _perMemberEventMaps = [
    FirestoreFields.rsvp,
    FirestoreFields.rsvpUpdatedAt,
    FirestoreFields.seenAt,
  ];

  /// Enregistre le RSVP de [uid] (id de fiche : soi = authUid, ou enfant).
  ///
  /// [viaCallable] : parent pour un enfant (rules : clé du connecté seulement).
  Future<void> updateRsvp({
    required String clubId,
    required String eventId,
    required String uid,
    required RsvpStatus status,
    bool viaCallable = false,
  }) async {
    if (viaCallable) {
      final callable =
          _functions.httpsCallable(cloudCallableName('setEventRsvp'));
      await callable.call<Map<String, dynamic>>({
        'clubId': clubId,
        'eventId': eventId,
        'memberId': uid,
        'value': status.firestoreValue,
      });
      return;
    }
    await _paths.events(clubId).doc(eventId).update({
      '${FirestoreFields.rsvp}.$uid': status.firestoreValue,
      '${FirestoreFields.rsvpUpdatedAt}.$uid': FieldValue.serverTimestamp(),
    });
  }

  /// Marque l'événement comme vu par [audienceId] (soi ou enfant).
  ///
  /// [viaCallable] : parent pour un enfant (callable `markEventSeen`).
  Future<void> markSeen({
    required String clubId,
    required String eventId,
    required String audienceId,
    bool viaCallable = false,
  }) async {
    if (viaCallable) {
      final callable =
          _functions.httpsCallable(cloudCallableName('markEventSeen'));
      await callable.call<Map<String, dynamic>>({
        'clubId': clubId,
        'eventId': eventId,
        'memberId': audienceId,
      });
      return;
    }
    await _paths.events(clubId).doc(eventId).update({
      '${FirestoreFields.seenAt}.$audienceId': FieldValue.serverTimestamp(),
    });
  }

  /// Stream de la fiche `members/{memberId}` (soi : [memberId] = authUid).
  Stream<ClubMember?> watchClubMember({
    required String clubId,
    required String memberId,
  }) {
    return _paths.memberRef(clubId, memberId).snapshots().map((doc) {
      if (!doc.exists) return null;
      return ClubMember.fromFirestore(doc);
    });
  }

  /// Retire / réintègre des joueurs convoqués (callable, multi-occurrences).
  ///
  /// Retourne le nombre d'événements modifiés.
  Future<int> updateConvocations({
    required String clubId,
    required String eventId,
    required List<String> excludeIds,
    required List<String> reintegrateIds,
    required bool following,
  }) async {
    final callable =
        _functions.httpsCallable(cloudCallableName('updateEventConvocations'));
    final result = await callable.call<Map<String, dynamic>>({
      'clubId': clubId,
      'eventId': eventId,
      'excludeIds': excludeIds,
      'reintegrateIds': reintegrateIds,
      'scope': following ? 'following' : 'occurrence',
    });
    return (result.data['updatedCount'] as num?)?.toInt() ?? 0;
  }

  /// Ajoute un convoqué aux événements à venir d'une équipe (joueur ou coach).
  ///
  /// Les joueurs retirés par le coach (`excludedMemberIds`) sont ignorés.
  Future<void> addAudienceToUpcomingTeamEvents({
    required String clubId,
    required String teamId,
    required String audienceId,
  }) async {
    if (audienceId.isEmpty) return;

    final snap = await _paths
        .events(clubId)
        .where(FirestoreFields.teamIds, arrayContains: teamId)
        .where(
          FirestoreFields.date,
          isGreaterThanOrEqualTo:
              Timestamp.fromDate(EventDateHelpers.startOfToday()),
        )
        .get();

    final batch = _paths.db.batch();
    var pending = 0;
    for (final doc in snap.docs) {
      final data = doc.data();
      if (data[FirestoreFields.canceled] == true) continue;
      final members =
          (data[FirestoreFields.teamMemberIds] as List<dynamic>?)
                  ?.whereType<String>()
                  .toList() ??
              [];
      if (members.contains(audienceId)) continue;
      final excluded =
          (data[FirestoreFields.excludedMemberIds] as List<dynamic>?) ?? [];
      if (excluded.contains(audienceId)) continue;

      batch.update(doc.reference, {
        FirestoreFields.teamMemberIds: FieldValue.arrayUnion([audienceId]),
      });
      pending++;
      if (pending >= 400) {
        await batch.commit();
        pending = 0;
      }
    }
    if (pending > 0) await batch.commit();
  }

  /// Retire un convoqué des événements à venir (ex. joueur retiré du roster).
  ///
  /// Supprime aussi la clé RSVP correspondante pour éviter un statut orphelin.
  Future<void> removeAudienceFromUpcomingTeamEvents({
    required String clubId,
    required String teamId,
    required String audienceId,
  }) async {
    if (audienceId.isEmpty) return;

    final snap = await _paths
        .events(clubId)
        .where(FirestoreFields.teamIds, arrayContains: teamId)
        .where(
          FirestoreFields.date,
          isGreaterThanOrEqualTo:
              Timestamp.fromDate(EventDateHelpers.startOfToday()),
        )
        .get();

    final batch = _paths.db.batch();
    var pending = 0;
    for (final doc in snap.docs) {
      final data = doc.data();
      if (data[FirestoreFields.canceled] == true) continue;
      final members =
          (data[FirestoreFields.teamMemberIds] as List<dynamic>?)
                  ?.whereType<String>()
                  .toList() ??
              [];
      final patch = <String, dynamic>{};
      if (members.contains(audienceId)) {
        patch[FirestoreFields.teamMemberIds] =
            FieldValue.arrayRemove([audienceId]);
      }
      for (final field in _perMemberEventMaps) {
        final values = data[field];
        if (values is Map && values.containsKey(audienceId)) {
          patch['$field.$audienceId'] = FieldValue.delete();
        }
      }
      if (patch.isEmpty) continue;
      batch.update(doc.reference, patch);
      pending++;
      if (pending >= 400) {
        await batch.commit();
        pending = 0;
      }
    }
    if (pending > 0) await batch.commit();
  }
}
