import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/services/member_service.dart';
import 'package:viro_team_v2/services/team_service.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Timeout des lectures de liste (membres, équipes) — évite un loader infini.
const Duration kChatDmTargetsLoadTimeout = Duration(seconds: 6);

/// Timeout d'une lecture unitaire (fiche, index compte, paquet `whereIn`).
const Duration kChatDmTargetsFetchTimeout = Duration(seconds: 3);

/// Taille max d'un paquet `whereIn` Firestore.
const int _kWhereInChunkSize = 30;

/// Destinataire possible d'une DM coach / admin (`createCoachDm`).
final class ChatDmTarget {
  /// Crée une cible ; [uid] est l'uid Auth passé à `createCoachDm`.
  const ChatDmTarget({
    required this.uid,
    required this.label,
    required this.role,
    this.member,
  });

  /// Auth uid passé à `createCoachDm`.
  final String uid;

  /// Nom affiché (nom complet ou libellé « sans nom »).
  final String label;

  /// Rôle club de la fiche (`admin`, `coach`…).
  final String role;

  /// Fiche membre source (avatar, initiales).
  final ClubMember? member;
}

/// Résout les coaches / admins joignables en DM (miroir de `createCoachDm`).
///
/// Lectures Firestore regroupées : un membre du club lit les fiches et l'index
/// `member_accounts` par paquets `whereIn` ; un parent seul (pas de `list`
/// permis par les règles) fait des `get` unitaires, dédupliqués et parallèles.
class ChatDmTargetsService {
  /// Crée le service ; [firestore] par défaut : [appFirestore].
  ChatDmTargetsService({
    required MemberService memberService,
    required TeamService teamService,
    FirebaseFirestore? firestore,
  })  : _memberService = memberService,
        _teamService = teamService,
        _db = firestore ?? appFirestore;

  final MemberService _memberService;
  final TeamService _teamService;
  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _members(String clubId) => _db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.membersSubcollection);

  CollectionReference<Map<String, dynamic>> _memberAccounts(String clubId) =>
      _db
          .collection(ProjectConfig.clubsCollection)
          .doc(clubId)
          .collection(ProjectConfig.memberAccountsSubcollection);

  /// Équipes du caller : équipes des enfants pour un parent seul
  /// ([guardianChildTeamIds]), sinon équipes de [callerMemberId] / [uid].
  ///
  /// Retourne une liste vide en cas d'erreur ou de timeout.
  Future<List<ClubTeam>> loadCallerTeams({
    required String clubId,
    required String uid,
    required bool isGuardianOnly,
    List<String> guardianChildTeamIds = const [],
    String? callerMemberId,
  }) async {
    try {
      if (isGuardianOnly) {
        return await _teamService
            .watchTeamsByIds(clubId: clubId, teamIds: guardianChildTeamIds)
            .first
            .timeout(kChatDmTargetsLoadTimeout);
      }
      return await _teamService
          .watchUserTeams(
            clubId: clubId,
            uid: callerMemberId ?? uid,
            alternateUid: uid,
          )
          .first
          .timeout(kChatDmTargetsLoadTimeout);
    } catch (_) {
      return const [];
    }
  }

  /// Cibles DM du caller [callerUid] dans [clubId] : admins ([clubAdminIds] +
  /// fiches `admin`) et coaches de [callerTeams], triés par libellé.
  ///
  /// [isGuardianOnly] : parent sans fiche → pas de `list` sur `members`.
  Future<List<ChatDmTarget>> loadTargets({
    required String clubId,
    required String callerUid,
    required List<String> clubAdminIds,
    required List<ClubTeam> callerTeams,
    required bool isGuardianOnly,
  }) async {
    var members = const <ClubMember>[];
    if (!isGuardianOnly) {
      try {
        members = await _memberService
            .watchClubMembers(clubId)
            .first
            .timeout(kChatDmTargetsLoadTimeout);
      } catch (_) {
        members = const [];
      }
    }

    final rosterIds = collectChatDmRosterIds(
      clubAdminIds: clubAdminIds,
      callerTeams: callerTeams,
      members: members,
    );
    final known = indexChatDmMembers(members);
    final missingIds = rosterIds.where((id) => !known.containsKey(id)).toList();
    final fetched = await fetchMembersByRosterOrAuthIds(
      clubId: clubId,
      ids: missingIds,
      canListMembers: !isGuardianOnly,
    );

    return buildChatDmTargets(
      rosterIds: rosterIds,
      memberByKey: indexChatDmMembers([...members, ...fetched]),
      callerUid: callerUid,
    );
  }

  /// Résout des ids (memberId ou uid Auth) en fiches membres, sans N+1 :
  /// 1. fiches `members/{id}` ;
  /// 2. ids restants → index `member_accounts/{id}.linkedMemberId` ;
  /// 3. fiches liées encore inconnues.
  ///
  /// [canListMembers] : `whereIn` par paquets de 30 (règle `list`) ; sinon
  /// `get` unitaires parallèles (parent). Un échec / timeout est ignoré.
  Future<List<ClubMember>> fetchMembersByRosterOrAuthIds({
    required String clubId,
    required Iterable<String> ids,
    required bool canListMembers,
  }) async {
    final wanted =
        ids.map((id) => id.trim()).where((id) => id.isNotEmpty).toSet();
    if (wanted.isEmpty) return const [];

    final direct = await _readDocs(
      _members(clubId),
      wanted,
      canList: canListMembers,
    );
    final members = direct.values.map(ClubMember.fromFirestore).toList();

    final unresolved = wanted.difference(direct.keys.toSet());
    if (unresolved.isEmpty) return members;

    final accounts = await _readDocs(
      _memberAccounts(clubId),
      unresolved,
      canList: canListMembers,
    );
    final linkedIds = linkedMemberIdsFromAccounts({
      for (final entry in accounts.entries) entry.key: entry.value.data(),
    }).difference(direct.keys.toSet());
    if (linkedIds.isEmpty) return members;

    final linked = await _readDocs(
      _members(clubId),
      linkedIds,
      canList: canListMembers,
    );
    return [...members, ...linked.values.map(ClubMember.fromFirestore)];
  }

  /// Lit les documents [ids] de [collection] (existants seulement), indexés
  /// par id : `whereIn` groupé si [canList], sinon `get` parallèles. Repli sur
  /// les `get` si une requête groupée est refusée.
  Future<Map<String, DocumentSnapshot<Map<String, dynamic>>>> _readDocs(
    CollectionReference<Map<String, dynamic>> collection,
    Set<String> ids, {
    required bool canList,
  }) async {
    if (ids.isEmpty) return const {};
    if (canList) {
      try {
        final chunks = chunkIds(ids, _kWhereInChunkSize);
        final snaps = await Future.wait(
          chunks.map(
            (chunk) => collection
                .where(FieldPath.documentId, whereIn: chunk)
                .get()
                .timeout(kChatDmTargetsFetchTimeout),
          ),
        );
        return {
          for (final snap in snaps)
            for (final doc in snap.docs) doc.id: doc,
        };
      } catch (_) {
        // Repli : get unitaires (règles ou timeout sur un paquet).
      }
    }

    final results = await Future.wait(
      ids.map((id) async {
        try {
          final snap = await collection
              .doc(id)
              .get()
              .timeout(kChatDmTargetsFetchTimeout);
          return snap.exists ? snap : null;
        } catch (_) {
          return null;
        }
      }),
    );
    return {
      for (final snap in results.nonNulls) snap.id: snap,
    };
  }
}

/// Découpe [ids] en paquets de [size] (limite `whereIn`).
List<List<String>> chunkIds(Iterable<String> ids, int size) {
  final list = ids.toList();
  return [
    for (var i = 0; i < list.length; i += size)
      list.sublist(i, i + size > list.length ? list.length : i + size),
  ];
}

/// Ids roster à contacter, dans l'ordre : [clubAdminIds], coaches de
/// [callerTeams], puis fiches `admin` de [members] (uid Auth + memberId).
Set<String> collectChatDmRosterIds({
  required List<String> clubAdminIds,
  required List<ClubTeam> callerTeams,
  required List<ClubMember> members,
}) {
  final rosterIds = <String>{...clubAdminIds};
  for (final team in callerTeams) {
    rosterIds.addAll(team.coachIds.where((id) => id.trim().isNotEmpty));
  }
  for (final member in members) {
    if (member.role != MemberRoles.admin) continue;
    final accountUid = member.accountUid?.trim();
    if (accountUid != null && accountUid.isNotEmpty) rosterIds.add(accountUid);
    rosterIds.add(member.memberId);
  }
  return rosterIds;
}

/// Index des fiches par memberId et par uid Auth (le dernier l'emporte).
Map<String, ClubMember> indexChatDmMembers(Iterable<ClubMember> members) {
  final memberByKey = <String, ClubMember>{};
  for (final member in members) {
    memberByKey[member.memberId] = member;
    final accountUid = member.accountUid?.trim();
    if (accountUid != null && accountUid.isNotEmpty) {
      memberByKey[accountUid] = member;
    }
  }
  return memberByKey;
}

/// memberIds liés (`linkedMemberId`) des docs `member_accounts` [accounts]
/// (clé = uid Auth), hors ceux identiques à leur uid.
Set<String> linkedMemberIdsFromAccounts(
  Map<String, Map<String, dynamic>?> accounts,
) {
  final linked = <String>{};
  accounts.forEach((authUid, data) {
    final memberId =
        (data?[FirestoreFields.linkedMemberId] as String?)?.trim() ?? '';
    if (memberId.isNotEmpty && memberId != authUid) linked.add(memberId);
  });
  return linked;
}

/// Construit les cibles DM : une par compte Auth (hors [callerUid]), fiches
/// sans compte ignorées, triées par libellé insensible à la casse.
List<ChatDmTarget> buildChatDmTargets({
  required Iterable<String> rosterIds,
  required Map<String, ClubMember> memberByKey,
  required String callerUid,
}) {
  final seenAuthUids = <String>{};
  final targets = <ChatDmTarget>[];
  for (final rosterOrAuthId in rosterIds) {
    final member = memberByKey[rosterOrAuthId];
    final accountUid = member?.accountUid?.trim();
    if (member == null ||
        accountUid == null ||
        accountUid.isEmpty ||
        accountUid == callerUid ||
        !seenAuthUids.add(accountUid)) {
      continue;
    }
    final fullName = member.fullName.trim();
    targets.add(
      ChatDmTarget(
        uid: accountUid,
        label: fullName.isNotEmpty ? fullName : AppCopy.members.unnamed,
        role: member.role,
        member: member,
      ),
    );
  }
  targets.sort(
    (a, b) => a.label.toLowerCase().compareTo(b.label.toLowerCase()),
  );
  return targets;
}
