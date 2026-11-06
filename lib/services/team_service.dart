import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/models/club_activity_event.dart';
import 'package:viro_team_v2/services/member/member_paths.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/services/club_activity_service.dart';
import 'package:viro_team_v2/services/event_service.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';
import 'package:viro_team_v2/utils/stream_combine.dart';

/// Bilan d’un ajout en masse au roster.
class BulkTeamAddResult {
  const BulkTeamAddResult({
    required this.added,
    required this.skipped,
    required this.failed,
  });

  /// Joueurs effectivement ajoutés (lots validés).
  final int added;

  /// Joueurs déjà dans l’équipe, laissés tels quels.
  final int skipped;

  /// Joueurs d’un lot dont l’écriture a échoué.
  final int failed;
}

class TeamService {
  TeamService({
    FirebaseFirestore? firestore,
    EventService? eventService,
    ClubActivityService? activityService,
  })  : _db = firestore ?? appFirestore,
        _eventService = eventService ?? EventService(firestore: firestore),
        _activity = activityService ??
            ClubActivityService(firestore: firestore);

  final FirebaseFirestore _db;
  final EventService _eventService;
  final ClubActivityService _activity;

  CollectionReference<Map<String, dynamic>> _teams(String clubId) => _db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.teamsSubcollection);

  CollectionReference<Map<String, dynamic>> _pendingMembers(String clubId) =>
      _db
          .collection(ProjectConfig.clubsCollection)
          .doc(clubId)
          .collection(ProjectConfig.pendingMembersSubcollection);

  /// Toutes les équipes du club, triées par nom.
  Stream<List<ClubTeam>> watchClubTeams({required String clubId}) {
    return _teams(clubId).snapshots().map((snap) {
      final teams = snap.docs
          .map((d) => ClubTeam.fromFirestore(clubId: clubId, doc: d))
          .toList()
        ..sort(
          (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
        );
      return teams;
    });
  }

  /// Équipes lues une par une par id (`get` individuel, pas de `list`).
  ///
  /// Requête compatible avec les droits d'un parent : il ne peut lire que
  /// `teams/{teamId}` pour `teamId ∈ parentTeamIds`. Les ids inconnus sont
  /// ignorés.
  Stream<List<ClubTeam>> watchTeamsByIds({
    required String clubId,
    required List<String> teamIds,
  }) {
    final uniqueIds = teamIds.where((id) => id.isNotEmpty).toSet().toList();
    if (uniqueIds.isEmpty) return Stream.value(<ClubTeam>[]);

    final streams = uniqueIds
        .map(
          (teamId) => _teams(clubId).doc(teamId).snapshots().map(
                (doc) => doc.exists
                    ? [ClubTeam.fromFirestore(clubId: clubId, doc: doc)]
                    : <ClubTeam>[],
              ),
        )
        .toList();

    return combineLatestListStreams(streams).map(
      (teams) => teams.toList()
        ..sort(
          (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
        ),
    );
  }

  /// Équipes où [uid] (id de fiche, = UID Auth du compte) est joueur ou coach.
  Stream<List<ClubTeam>> watchUserTeams({
    required String clubId,
    required String uid,
  }) {
    final streams = <Stream<List<ClubTeam>>>[
      for (final rosterField in [
        FirestoreFields.playerIds,
        FirestoreFields.coachIds,
      ])
        _teams(clubId)
            .where(rosterField, arrayContains: uid)
            .snapshots()
            .map(
              (snap) => snap.docs
                  .map((d) => ClubTeam.fromFirestore(clubId: clubId, doc: d))
                  .toList(),
            ),
    ];

    return combineLatestListStreams(streams).map((teams) {
      final byId = <String, ClubTeam>{};
      for (final team in teams) {
        byId[team.id] = team;
      }
      return byId.values.toList()
        ..sort(
          (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
        );
    });
  }

  Future<Map<String, TeamMemberProfile>> fetchMemberProfiles(
    List<String> uids,
  ) async {
    if (uids.isEmpty) return {};

    final unique = uids.toSet().toList();
    final result = <String, TeamMemberProfile>{};

    for (var i = 0; i < unique.length; i += 30) {
      final chunk = unique.skip(i).take(30).toList();
      final snap = await _db
          .collection(ProjectConfig.usersCollection)
          .where(FieldPath.documentId, whereIn: chunk)
          .get();

      for (final doc in snap.docs) {
        final user = ViroUser.fromFirestore(doc);
        result[user.uid] = TeamMemberProfile(
          uid: user.uid,
          displayName: user.displayName.isNotEmpty
              ? user.displayName
              : '${user.firstName} ${user.lastName}'.trim(),
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
        );
      }
    }

    return result;
  }

  Stream<List<PendingTeamMember>> watchPendingMembers(String clubId) {
    return _pendingMembers(clubId).snapshots().map((snap) {
      return snap.docs
          .map((doc) {
            final data = doc.data();
            return PendingTeamMember(
              id: doc.id,
              firstName: data[FirestoreFields.firstName] as String? ?? '',
              lastName: data[FirestoreFields.lastName] as String? ?? '',
              email: data[FirestoreFields.email] as String?,
            );
          })
          .toList()
        ..sort(
          (a, b) => a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase()),
        );
    });
  }

  Future<String> createTeam({
    required String clubId,
    required String name,
    required String category,
  }) async {
    final trimmedName = name.trim();
    final ref = _teams(clubId).doc();
    final batch = _db.batch();
    batch.set(ref, {
      FirestoreFields.name: trimmedName,
      FirestoreFields.category: category,
      FirestoreFields.playerIds: <String>[],
      FirestoreFields.coachIds: <String>[],
      FirestoreFields.pendingPlayerIds: <String>[],
      FirestoreFields.createdAt: FieldValue.serverTimestamp(),
    });
    _activity.appendToBatch(
      batch: batch,
      clubId: clubId,
      type: ClubActivityTypes.teamCreated,
      count: 1,
      summary: trimmedName,
      teamId: ref.id,
    );
    await batch.commit();
    return ref.id;
  }

  /// Met à jour les liens de discussion de l'équipe (groupe + parents).
  ///
  /// Les chaînes vides ou nulles suppriment le champ correspondant.
  Future<void> updateTeamMessagingLinks({
    required String clubId,
    required String teamId,
    String? messagingLink,
    String? parentsMessagingLink,
  }) async {
    final teamLink = messagingLink?.trim();
    final parentsLink = parentsMessagingLink?.trim();

    await _teams(clubId).doc(teamId).update({
      FirestoreFields.messagingLink: (teamLink == null || teamLink.isEmpty)
          ? FieldValue.delete()
          : teamLink,
      FirestoreFields.parentsMessagingLink:
          (parentsLink == null || parentsLink.isEmpty)
              ? FieldValue.delete()
              : parentsLink,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }

  /// Ajoute un joueur au roster et le convoque aux événements à venir.
  Future<void> addPlayerToTeam({
    required String clubId,
    required String teamId,
    required String uid,
  }) async {
    await _syncRosterAndMemberTeamIds(
      clubId: clubId,
      teamId: teamId,
      rosterUid: uid,
      rosterField: FirestoreFields.playerIds,
      add: true,
    );
    await _syncUpcomingAudienceForPlayer(
      clubId: clubId,
      teamId: teamId,
      rosterUid: uid,
      add: true,
    );
  }

  Future<void> addCoachToTeam({
    required String clubId,
    required String teamId,
    required String uid,
  }) async {
    await _syncRosterAndMemberTeamIds(
      clubId: clubId,
      teamId: teamId,
      rosterUid: uid,
      rosterField: FirestoreFields.coachIds,
      add: true,
    );
    await _syncUpcomingAudienceForPlayer(
      clubId: clubId,
      teamId: teamId,
      rosterUid: uid,
      add: true,
    );
  }

  /// Ajout en masse de joueurs au roster, par lots atomiques (`WriteBatch`).
  ///
  /// Fiches liées → `playerIds` + `members.teamIds` ; fiches sans compte →
  /// `pendingPlayerIds`. Un lot passe entièrement ou pas du tout : le
  /// compteur [BulkTeamAddResult.added] ne compte que les lots validés,
  /// [BulkTeamAddResult.failed] ceux qui ont échoué. Les convocations aux
  /// événements à venir sont synchronisées ensuite, en best-effort.
  Future<BulkTeamAddResult> addPlayersToTeam({
    required String clubId,
    required ClubTeam team,
    required List<ClubMember> members,
  }) async {
    final toAdd = <ClubMember>[];
    var skipped = 0;
    for (final member in members) {
      final alreadyOnTeam = member.hasLinkedAccount
          ? team.isOnPlayerRoster(member)
          : team.pendingPlayerIds.contains(member.memberId);
      if (alreadyOnTeam) {
        skipped += 1;
      } else {
        toAdd.add(member);
      }
    }
    if (toAdd.isEmpty) {
      return BulkTeamAddResult(added: 0, skipped: skipped, failed: 0);
    }

    final teamRef = _teams(clubId).doc(team.id);
    var added = 0;
    var failed = 0;
    final synced = <ClubMember>[];

    for (var start = 0; start < toAdd.length; start += _bulkBatchSize) {
      final chunk = toAdd.sublist(
        start,
        (start + _bulkBatchSize).clamp(0, toAdd.length),
      );
      final linked = chunk.where((m) => m.hasLinkedAccount).toList();
      final pending = chunk.where((m) => !m.hasLinkedAccount).toList();

      final batch = _db.batch();
      batch.update(teamRef, {
        if (linked.isNotEmpty)
          FirestoreFields.playerIds: FieldValue.arrayUnion(
            linked.map((m) => m.memberId).toList(),
          ),
        if (pending.isNotEmpty)
          FirestoreFields.pendingPlayerIds: FieldValue.arrayUnion(
            pending.map((m) => m.memberId).toList(),
          ),
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });
      for (final member in linked) {
        batch.update(_members(clubId).doc(member.memberId), {
          FirestoreFields.teamIds: FieldValue.arrayUnion([team.id]),
          FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
        });
      }

      try {
        await batch.commit();
        added += chunk.length;
        synced.addAll(linked);
      } catch (_) {
        failed += chunk.length;
      }
    }

    for (final member in synced) {
      try {
        await _syncUpcomingAudienceForPlayer(
          clubId: clubId,
          teamId: team.id,
          rosterUid: member.memberId,
          add: true,
        );
      } catch (_) {
        // Le roster est à jour ; la convocation se rattrape à la prochaine
        // synchro (`reconcileRosterIds`) ou à l’ouverture de l’événement.
      }
    }

    return BulkTeamAddResult(added: added, skipped: skipped, failed: failed);
  }

  /// Taille d’un lot : 1 écriture équipe + 1 par membre lié, sous la limite
  /// Firestore de 500 écritures par batch.
  static const int _bulkBatchSize = 400;

  Future<void> addPendingPlayerToTeam({
    required String clubId,
    required String teamId,
    required String pendingId,
  }) async {
    await _teams(clubId).doc(teamId).update({
      FirestoreFields.pendingPlayerIds: FieldValue.arrayUnion([pendingId]),
    });
  }

  /// Retire un joueur du roster et des convocations / RSVP à venir.
  ///
  /// Conserve l'audience si le membre reste coach de l'équipe.
  Future<void> removePlayerFromTeam({
    required String clubId,
    required String teamId,
    required String uid,
  }) async {
    await _syncRosterAndMemberTeamIds(
      clubId: clubId,
      teamId: teamId,
      rosterUid: uid,
      rosterField: FirestoreFields.playerIds,
      add: false,
    );
    if (await _isStillOnTeamRoster(
      clubId: clubId,
      teamId: teamId,
      rosterUid: uid,
    )) {
      return;
    }
    await _syncUpcomingAudienceForPlayer(
      clubId: clubId,
      teamId: teamId,
      rosterUid: uid,
      add: false,
    );
  }

  Future<void> removeCoachFromTeam({
    required String clubId,
    required String teamId,
    required String uid,
  }) async {
    await _syncRosterAndMemberTeamIds(
      clubId: clubId,
      teamId: teamId,
      rosterUid: uid,
      rosterField: FirestoreFields.coachIds,
      add: false,
    );
    if (await _isStillOnTeamRoster(
      clubId: clubId,
      teamId: teamId,
      rosterUid: uid,
    )) {
      return;
    }
    await _syncUpcomingAudienceForPlayer(
      clubId: clubId,
      teamId: teamId,
      rosterUid: uid,
      add: false,
    );
  }

  Future<void> removePendingPlayerFromTeam({
    required String clubId,
    required String teamId,
    required String pendingId,
  }) async {
    await _teams(clubId).doc(teamId).update({
      FirestoreFields.pendingPlayerIds: FieldValue.arrayRemove([pendingId]),
    });
  }

  Future<List<PendingTeamMember>> fetchPendingMembers({
    required String clubId,
    required List<String> pendingIds,
  }) async {
    if (pendingIds.isEmpty) return [];

    final refs = pendingIds
        .map((id) => _pendingMembers(clubId).doc(id))
        .toList();
    final snaps = await Future.wait(refs.map((r) => r.get()));

    return snaps
        .where((s) => s.exists)
        .map((doc) {
          final data = doc.data() ?? {};
          return PendingTeamMember(
            id: doc.id,
            firstName: data[FirestoreFields.firstName] as String? ?? '',
            lastName: data[FirestoreFields.lastName] as String? ?? '',
            email: data[FirestoreFields.email] as String?,
          );
        })
        .toList();
  }

  CollectionReference<Map<String, dynamic>> _members(String clubId) => _db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.membersSubcollection);

  /// Met à jour roster équipe + `members.teamIds` dans une transaction.
  Future<void> _syncRosterAndMemberTeamIds({
    required String clubId,
    required String teamId,
    required String rosterUid,
    required String rosterField,
    required bool add,
  }) async {
    final memberRef = clubMemberRef(_db, clubId, rosterUid);
    final teamRef = _teams(clubId).doc(teamId);

    await _db.runTransaction((tx) async {
      final teamSnap = await tx.get(teamRef);
      if (!teamSnap.exists) {
        throw StateError('Équipe introuvable.');
      }

      final teamData = teamSnap.data() ?? {};
      final memberSnap = await tx.get(memberRef);
      final memberData = memberSnap.exists ? memberSnap.data() : null;

      List<String> readIds(String field) =>
          ((teamData[field] as List<dynamic>?)?.whereType<String>() ??
                  const <String>[])
              .toList();

      final currentIds = readIds(rosterField);
      late final List<String> nextIds;
      if (add) {
        nextIds = currentIds.contains(rosterUid)
            ? currentIds
            : [...currentIds, rosterUid];
      } else {
        nextIds = currentIds.where((id) => id != rosterUid).toList();
      }

      tx.update(teamRef, {
        rosterField: nextIds,
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });

      if (memberData == null) return;

      final playerIds = rosterField == FirestoreFields.playerIds
          ? nextIds
          : readIds(FirestoreFields.playerIds);
      final coachIds = rosterField == FirestoreFields.coachIds
          ? nextIds
          : readIds(FirestoreFields.coachIds);
      final stillOnTeam =
          playerIds.contains(rosterUid) || coachIds.contains(rosterUid);

      final currentTeamIds =
          ((memberData[FirestoreFields.teamIds] as List<dynamic>?)
                      ?.whereType<String>() ??
                  const <String>[])
              .toList();

      if (add) {
        if (currentTeamIds.contains(teamId)) return;
        tx.update(memberRef, {
          FirestoreFields.teamIds: [...currentTeamIds, teamId],
          FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      if (stillOnTeam || !currentTeamIds.contains(teamId)) return;
      tx.update(memberRef, {
        FirestoreFields.teamIds:
            currentTeamIds.where((id) => id != teamId).toList(),
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  /// True si [rosterUid] est encore joueur ou coach de l'équipe.
  Future<bool> _isStillOnTeamRoster({
    required String clubId,
    required String teamId,
    required String rosterUid,
  }) async {
    final teamSnap = await _teams(clubId).doc(teamId).get();
    if (!teamSnap.exists) return false;
    final team = ClubTeam.fromFirestore(clubId: clubId, doc: teamSnap);
    return team.playerIds.contains(rosterUid) ||
        team.coachIds.contains(rosterUid);
  }

  /// Synchronise `teamMemberIds` / RSVP des events à venir après un changement
  /// de roster joueur ou coach ([rosterUid] = id de la fiche membre).
  Future<void> _syncUpcomingAudienceForPlayer({
    required String clubId,
    required String teamId,
    required String rosterUid,
    required bool add,
  }) async {
    if (add) {
      await _eventService.addAudienceToUpcomingTeamEvents(
        clubId: clubId,
        teamId: teamId,
        audienceId: rosterUid,
      );
      return;
    }
    await _eventService.removeAudienceFromUpcomingTeamEvents(
      clubId: clubId,
      teamId: teamId,
      audienceId: rosterUid,
    );
  }
}
