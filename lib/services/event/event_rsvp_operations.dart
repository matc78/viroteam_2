import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/services/event/event_date_helpers.dart';
import 'package:viro_team_v2/services/event/event_paths.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';

/// RSVP, appel coach, résolution d'audience et stats de présence.
class EventRsvpOperations {
  /// Crée le module RSVP / attendance / audience.
  EventRsvpOperations({
    required EventPaths paths,
    required FirebaseFunctions functions,
  })  : _paths = paths,
        _functions = functions;

  final EventPaths _paths;
  final FirebaseFunctions _functions;

  /// ID présent dans `teamMemberIds` / `playerIds` (doc `members/{memberId}`).
  String rosterAudienceId(ClubMember member, String authUid) =>
      member.memberId;

  /// Identifiant utilisé dans `teamMemberIds` / `rsvp` pour un membre du club.
  Future<String> resolveAudienceId({
    required String clubId,
    required String authUid,
  }) async {
    final indexSnap = await _paths.memberAccountRef(clubId, authUid).get();

    if (indexSnap.exists) {
      final linked =
          indexSnap.data()?[FirestoreFields.linkedMemberId] as String?;
      if (linked != null && linked.isNotEmpty) return linked;
    }

    final memberSnap = await _paths.memberRef(clubId, authUid).get();
    if (memberSnap.exists) {
      final accountUid =
          memberSnap.data()?[FirestoreFields.accountUid] as String?;
      if (accountUid != null && accountUid.isNotEmpty) return authUid;
      return memberSnap.id;
    }

    return authUid;
  }

  /// Enregistre le RSVP de [uid] (memberId cible : soi ou enfant).
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
    });
  }

  /// Enregistre l'appel coach (`attendance`) sans modifier `rsvp`.
  Future<void> updateAttendance({
    required String clubId,
    required String eventId,
    required Map<String, AttendanceStatus> statusesByMemberId,
    required String markedByUid,
  }) async {
    if (statusesByMemberId.isEmpty) return;
    final markedAt = Timestamp.now();
    final updates = <String, dynamic>{
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    };
    for (final entry in statusesByMemberId.entries) {
      updates['${FirestoreFields.attendance}.${entry.key}'] = {
        FirestoreFields.status: entry.value.firestoreValue,
        FirestoreFields.markedBy: markedByUid,
        FirestoreFields.markedAt: markedAt,
      };
    }
    await _paths.events(clubId).doc(eventId).update(updates);
  }

  /// Stream de la fiche membre liée à [uid] (via `memberAccounts` si besoin).
  Stream<ClubMember?> watchClubMember({
    required String clubId,
    required String uid,
  }) {
    final accountIndexRef = _paths.memberAccountRef(clubId, uid);

    return accountIndexRef.snapshots().asyncExpand((indexSnap) {
      String? linkedMemberId;
      if (indexSnap.exists) {
        final indexData = indexSnap.data();
        linkedMemberId =
            indexData?[FirestoreFields.linkedMemberId] as String?;
      }
      final targetId = linkedMemberId ?? uid;
      return _paths.memberRef(clubId, targetId).snapshots().map((doc) {
        if (!doc.exists) return null;
        return ClubMember.fromFirestore(doc);
      });
    });
  }

  /// Taux de réponses positives (RSVP yes) sur les 30 derniers jours.
  ///
  /// Lit `rsvp` ; bascule sur le legacy `attendance` via [ClubEvent.rsvpStatusForUser]
  /// si `rsvp` est vide.
  Future<double?> computeAttendanceRate({
    required String clubId,
    required String authUid,
  }) async {
    final audienceId = await resolveAudienceId(
      clubId: clubId,
      authUid: authUid,
    );
    final since = DateTime.now().subtract(const Duration(days: 30));
    final snap = await _paths
        .events(clubId)
        .where(FirestoreFields.teamMemberIds, arrayContains: audienceId)
        .where(
          FirestoreFields.date,
          isGreaterThanOrEqualTo: Timestamp.fromDate(since),
        )
        .where(
          FirestoreFields.date,
          isLessThan: Timestamp.fromDate(EventDateHelpers.startOfToday()),
        )
        .get();

    var answered = 0;
    var yesCount = 0;

    for (final doc in snap.docs) {
      final event = ClubEvent.fromFirestore(clubId: clubId, doc: doc);
      if (event.canceled) continue;
      final status = event.rsvpStatusForUser(
        authUid,
        clubAudienceId: audienceId,
      );
      if (status == RsvpStatus.none) continue;
      answered++;
      if (status == RsvpStatus.yes) yesCount++;
    }

    if (answered == 0) return null;
    return yesCount / answered * 100;
  }

  /// Taux de présence terrain (appel coach) sur 30 j.
  ///
  /// Retourne null s’il n’y a pas encore d’appel renseigné (évite 0 % trompeur).
  Future<double?> computePitchAttendanceRate({
    required String clubId,
  }) async {
    final since = DateTime.now().subtract(const Duration(days: 30));
    final snap = await _paths
        .events(clubId)
        .where(
          FirestoreFields.date,
          isGreaterThanOrEqualTo: Timestamp.fromDate(since),
        )
        .where(
          FirestoreFields.date,
          isLessThan: Timestamp.fromDate(EventDateHelpers.startOfToday()),
        )
        .get();

    var presentCount = 0;
    var markedCount = 0;
    var eventsWithRollCall = 0;

    for (final doc in snap.docs) {
      final event = ClubEvent.fromFirestore(clubId: clubId, doc: doc);
      if (event.canceled || !event.hasRollCall) continue;
      eventsWithRollCall++;
      for (final uid in event.teamMemberIds) {
        final status = event.attendanceStatusFor(uid);
        if (status == null) continue;
        markedCount++;
        if (status == AttendanceStatus.present) presentCount++;
      }
    }

    if (eventsWithRollCall < 1 || markedCount == 0) return null;
    return presentCount / markedCount * 100;
  }

  /// Ajoute un convoqué aux événements à venir d'une équipe (joueur ou coach).
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
      final rsvp = data[FirestoreFields.rsvp];
      final hasRsvp = rsvp is Map && rsvp.containsKey(audienceId);
      if (!members.contains(audienceId) && !hasRsvp) continue;

      final patch = <String, dynamic>{};
      if (members.contains(audienceId)) {
        patch[FirestoreFields.teamMemberIds] =
            FieldValue.arrayRemove([audienceId]);
      }
      if (hasRsvp) {
        patch['${FirestoreFields.rsvp}.$audienceId'] = FieldValue.delete();
      }
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
