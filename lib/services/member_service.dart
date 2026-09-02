import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_invitation.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';
import 'package:viro_team_v2/utils/email_validation.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';
import 'package:viro_team_v2/utils/invite_message.dart';

class AddMemberResult {
  const AddMemberResult({
    required this.member,
    required this.invitation,
  });

  final ClubMember member;
  final ClubInvitation invitation;
}

class ClubParentChildRef {
  const ClubParentChildRef({
    required this.memberId,
    required this.displayName,
    required this.status,
    this.parentUid,
    this.invitationId,
    this.invitationCode,
    this.expiresAt,
  });

  final String memberId;
  final String displayName;
  final String status;
  final String? parentUid;
  final String? invitationId;
  final String? invitationCode;
  final DateTime? expiresAt;

  bool get inviteValid {
    if (status != GuardianStatuses.pending) return true;
    if (expiresAt == null) return true;
    return !expiresAt!.isBefore(DateTime.now());
  }
}

class ClubParentEntry {
  const ClubParentEntry({
    required this.rowKey,
    required this.displayName,
    required this.status,
    required this.children,
    this.parentUid,
    this.avatarUrl,
    this.email,
    this.firstName,
    this.lastName,
    this.rosterMemberId,
  });

  final String rowKey;
  final String? parentUid;
  final String displayName;
  final String? firstName;
  final String? lastName;
  final String? avatarUrl;
  final String? email;
  final String status;
  final List<ClubParentChildRef> children;
  final String? rosterMemberId;

  bool get isPending => status == GuardianStatuses.pending;
  bool get isActive => status == GuardianStatuses.active;

  ClubParentChildRef? get primaryPendingChild {
    for (final child in children) {
      if (child.status == GuardianStatuses.pending) return child;
    }
    return null;
  }
}

class MemberService {
  MemberService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  })  : _db = firestore ?? appFirestore,
        _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'europe-west1');

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  /// Valide et normalise l'e-mail obligatoire d'une invitation membre
  /// (trim + minuscules). Lève [ArgumentError] si vide ou mal formé.
  static String requireNormalizedEmail(String? rawEmail) {
    final emailError = requiredEmailError(rawEmail ?? '');
    if (emailError != null) {
      throw ArgumentError(emailError);
    }
    return normalizeEmail(rawEmail!);
  }

  CollectionReference<Map<String, dynamic>> _members(String clubId) => _db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.membersSubcollection);

  CollectionReference<Map<String, dynamic>> _invitations(String clubId) => _db
      .collection(ProjectConfig.clubsCollection)
      .doc(clubId)
      .collection(ProjectConfig.invitationsSubcollection);

  /// Liste des membres : admin → coach → joueur, puis prénom A→Z.
  Stream<List<ClubMember>> watchClubMembers(String clubId) {
    return _members(clubId).snapshots().asyncMap((snap) async {
      final members = <ClubMember>[];
      for (final doc in snap.docs) {
        var member = ClubMember.fromFirestore(doc);
        member = await _enrichMember(clubId, member);
        members.add(member);
      }
      members.sort((a, b) {
        final roleCmp = MemberRoleHierarchy.level(b.role)
            .compareTo(MemberRoleHierarchy.level(a.role));
        if (roleCmp != 0) return roleCmp;
        return _sortKeyFirstName(a).compareTo(_sortKeyFirstName(b));
      });
      return members;
    });
  }

  static String _sortKeyFirstName(ClubMember member) {
    final first = member.firstName?.trim();
    if (first != null && first.isNotEmpty) {
      return first.toLowerCase();
    }
    final parts = member.fullName.trim().split(RegExp(r'\s+'));
    if (parts.isNotEmpty && parts.first.isNotEmpty) {
      return parts.first.toLowerCase();
    }
    return member.fullName.toLowerCase();
  }

  Future<ClubMember> _enrichMember(String clubId, ClubMember member) async {
    var enriched = member;

    final linkedUid = member.accountUid;
    if (linkedUid != null) {
      final userDoc = await _db
          .collection(ProjectConfig.usersCollection)
          .doc(linkedUid)
          .get();
      if (userDoc.exists) {
        final data = userDoc.data() ?? {};
        enriched = enriched.copyWith(
          hasLinkedAccount: true,
          displayName: enriched.displayName ??
              data[FirestoreFields.displayName] as String?,
          avatarUrl:
              enriched.avatarUrl ?? data[FirestoreFields.avatarUrl] as String?,
          email: enriched.email ?? data[FirestoreFields.email] as String?,
        );
      }
    }

    if (member.activeInvitationId != null) {
      final inviteDoc = await _invitations(clubId)
          .doc(member.activeInvitationId)
          .get();
      if (inviteDoc.exists) {
        final invite = ClubInvitation.fromDocument(inviteDoc);
        if (invite.isPending) {
          enriched = enriched.copyWith(
            pendingInviteCode: invite.code,
            pendingInviteExpiresAt: invite.expiresAt,
          );
        }
      }
    }

    return enriched;
  }

  /// Crée une fiche membre pré-remplie et son invitation `pending`.
  ///
  /// [email] est obligatoire : l'invitation ne pourra être acceptée que par
  /// ce compte. Il est normalisé (trim + minuscules) et écrit sur
  /// l'invitation (`email`) et la fiche (`snapshot.email`).
  Future<AddMemberResult> addMemberWithInvitation({
    required String clubId,
    required String firstName,
    required String lastName,
    required String role,
    required String sentByUid,
    required Club club,
    required String email,
  }) async {
    final trimmedFirst = firstName.trim();
    final trimmedLast = lastName.trim();
    if (trimmedFirst.isEmpty || trimmedLast.isEmpty) {
      throw ArgumentError('Le prénom et le nom sont obligatoires.');
    }
    if (role != MemberRoles.player && role != MemberRoles.coach) {
      throw ArgumentError('Seuls joueur et coach peuvent être ajoutés ici.');
    }
    final normalizedEmail = requireNormalizedEmail(email);

    final memberRef = _members(clubId).doc();
    final inviteRef = _invitations(clubId).doc();
    final clubRef =
        _db.collection(ProjectConfig.clubsCollection).doc(clubId);
    final code = generateInviteCode();
    final expiresAt = DateTime.now().add(const Duration(days: 7));
    final displayName = '$trimmedFirst $trimmedLast';
    final snapshot = <String, dynamic>{
      FirestoreFields.displayName: displayName,
      FirestoreFields.email: normalizedEmail,
    };

    await _db.runTransaction((tx) async {
      final clubSnap = await tx.get(clubRef);
      final memberCount =
          (clubSnap.data()?[FirestoreFields.memberCount] as num?)?.toInt() ?? 0;

      tx.set(memberRef, {
        FirestoreFields.memberId: memberRef.id,
        FirestoreFields.role: role,
        FirestoreFields.status: 'active',
        FirestoreFields.firstName: trimmedFirst,
        FirestoreFields.lastName: trimmedLast,
        FirestoreFields.teamIds: <String>[],
        FirestoreFields.snapshot: snapshot,
        FirestoreFields.activeInvitationId: inviteRef.id,
        if (role == MemberRoles.player)
          FirestoreFields.playerInfo: {FirestoreFields.license: ''},
        if (role == MemberRoles.coach)
          FirestoreFields.coachInfo: {'headCoach': false},
        FirestoreFields.joinedAt: FieldValue.serverTimestamp(),
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(inviteRef, {
        FirestoreFields.code: code,
        FirestoreFields.type: InvitationTypes.member,
        FirestoreFields.role: role,
        FirestoreFields.status: InvitationStatus.pending,
        FirestoreFields.email: normalizedEmail,
        FirestoreFields.memberId: memberRef.id,
        FirestoreFields.sentBy: sentByUid,
        FirestoreFields.sentAt: FieldValue.serverTimestamp(),
        FirestoreFields.expiresAt: Timestamp.fromDate(expiresAt),
        FirestoreFields.clubName: club.name,
        FirestoreFields.clubSport: club.sport,
        FirestoreFields.firstName: trimmedFirst,
        FirestoreFields.lastName: trimmedLast,
      });

      tx.update(clubRef, {
        FirestoreFields.memberCount: memberCount + 1,
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });
    });

    final member = ClubMember(
      memberId: memberRef.id,
      role: role,
      status: 'active',
      firstName: trimmedFirst,
      lastName: trimmedLast,
      displayName: displayName,
      email: normalizedEmail,
      joinedAt: DateTime.now(),
      activeInvitationId: inviteRef.id,
      pendingInviteCode: code,
      pendingInviteExpiresAt: expiresAt,
    );

    final invitation = ClubInvitation(
      id: inviteRef.id,
      clubId: clubId,
      code: code,
      role: role,
      status: InvitationStatus.pending,
      memberId: memberRef.id,
      email: normalizedEmail,
      sentBy: sentByUid,
      sentAt: DateTime.now(),
      expiresAt: expiresAt,
      clubName: club.name,
      clubSport: club.sport,
      firstName: trimmedFirst,
      lastName: trimmedLast,
    );

    return AddMemberResult(member: member, invitation: invitation);
  }

  /// Met à jour prénom / nom / e-mail d’un membre pas encore inscrit.
  ///
  /// L'e-mail est obligatoire (normalisé) et synchronisé sur l’invitation
  /// active si présente : seul ce compte pourra accepter l'invitation.
  Future<void> updatePendingMemberProfile({
    required String clubId,
    required String memberId,
    required String firstName,
    required String lastName,
    required String email,
  }) async {
    final trimmedFirst = firstName.trim();
    final trimmedLast = lastName.trim();
    if (trimmedFirst.isEmpty || trimmedLast.isEmpty) {
      throw ArgumentError('Le prénom et le nom sont obligatoires.');
    }
    final normalizedEmail = requireNormalizedEmail(email);

    final memberRef = _members(clubId).doc(memberId);

    await _db.runTransaction((tx) async {
      final memberSnap = await tx.get(memberRef);
      if (!memberSnap.exists) {
        throw StateError('Membre introuvable.');
      }

      final data = memberSnap.data()!;
      final accountUid =
          (data[FirestoreFields.accountUid] as String?)?.trim() ?? '';
      final legacyUserId =
          (data[FirestoreFields.userId] as String?)?.trim() ?? '';
      if (accountUid.isNotEmpty || legacyUserId.isNotEmpty) {
        throw StateError(
          'Impossible de modifier l\'identité d\'un membre déjà inscrit.',
        );
      }

      final activeInvitationId =
          (data[FirestoreFields.activeInvitationId] as String?)?.trim() ?? '';
      DocumentReference<Map<String, dynamic>>? inviteRef;
      DocumentSnapshot<Map<String, dynamic>>? inviteSnap;
      if (activeInvitationId.isNotEmpty) {
        inviteRef = _invitations(clubId).doc(activeInvitationId);
        inviteSnap = await tx.get(inviteRef);
      }

      final existingSnapshot = data[FirestoreFields.snapshot];
      final nextSnapshot = <String, dynamic>{
        if (existingSnapshot is Map<String, dynamic>) ...existingSnapshot,
        FirestoreFields.displayName: '$trimmedFirst $trimmedLast',
        FirestoreFields.email: normalizedEmail,
      };

      tx.update(memberRef, {
        FirestoreFields.firstName: trimmedFirst,
        FirestoreFields.lastName: trimmedLast,
        FirestoreFields.snapshot: nextSnapshot,
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });

      if (inviteRef != null && inviteSnap?.exists == true) {
        tx.update(inviteRef, {
          FirestoreFields.firstName: trimmedFirst,
          FirestoreFields.lastName: trimmedLast,
          FirestoreFields.email: normalizedEmail,
          FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
  }

  /// Change le rôle d'un membre via la callable `setMemberRole`
  /// (vérifications admin, dernier admin, `club.adminIds` et
  /// `users/{uid}.clubMemberships` gérés côté serveur).
  Future<void> updateMemberRole({
    required String clubId,
    required String memberId,
    required String newRole,
  }) async {
    if (!MemberRoleHierarchy.isAdmin(newRole) &&
        newRole != MemberRoles.coach &&
        newRole != MemberRoles.player) {
      throw ArgumentError('Rôle invalide.');
    }

    final callable =
        _functions.httpsCallable(cloudCallableName('setMemberRole'));
    await callable.call(<String, dynamic>{
      FirestoreFields.clubId: clubId,
      FirestoreFields.memberId: memberId,
      FirestoreFields.role: newRole,
    });
  }

  /// Retire un membre du club via la callable `removeMember`
  /// (fiche, index `member_accounts`, équipes, invitation et
  /// `clubMemberships` nettoyés côté serveur).
  Future<void> removeMember({
    required String clubId,
    required String memberId,
  }) async {
    final callable =
        _functions.httpsCallable(cloudCallableName('removeMember'));
    await callable.call(<String, dynamic>{
      FirestoreFields.clubId: clubId,
      FirestoreFields.memberId: memberId,
    });
  }

  /// Parents liés aux fiches du club via `members/{memberId}/guardians`
  /// et invitations `type: guardian` pending. Une entrée = un parent (uid/email).
  Future<List<ClubParentEntry>> fetchClubParents(String clubId) async {
    final membersSnap = await _members(clubId).get();
    final membersById = <String, ClubMember>{};
    final membersByAccount = <String, ClubMember>{};
    for (final memberDoc in membersSnap.docs) {
      final member = ClubMember.fromFirestore(memberDoc);
      membersById[member.memberId] = member;
      final accountUid = member.accountUid?.trim();
      if (accountUid != null && accountUid.isNotEmpty) {
        membersByAccount[accountUid] = member;
      }
    }

    // Une seule lecture des invitations pending du club (évite N requêtes).
    final pendingGuardianByMember =
        <String, QueryDocumentSnapshot<Map<String, dynamic>>>{};
    try {
      final pendingInvitesSnap = await _invitations(clubId)
          .where(FirestoreFields.status, isEqualTo: InvitationStatus.pending)
          .get();
      for (final inviteDoc in pendingInvitesSnap.docs) {
        final type = inviteDoc.data()[FirestoreFields.type] as String? ?? '';
        if (type != InvitationTypes.guardian) continue;
        final memberId =
            (inviteDoc.data()[FirestoreFields.memberId] as String?)?.trim() ?? '';
        if (memberId.isEmpty) continue;
        pendingGuardianByMember.putIfAbsent(memberId, () => inviteDoc);
      }
    } catch (_) {
      // Invites illisibles : on continue avec les seuls guardians.
    }

    // Guardians en parallèle (une requête par membre, sans boucle séquentielle).
    final guardianSnaps = await Future.wait(
      membersSnap.docs.map(
        (memberDoc) => memberDoc.reference
            .collection(ProjectConfig.guardiansSubcollection)
            .get(),
      ),
    );

    final occupyingByMemberIndex =
        <int, QueryDocumentSnapshot<Map<String, dynamic>>>{};
    final parentUids = <String>{};
    for (var index = 0; index < membersSnap.docs.length; index++) {
      final guardiansSnap = guardianSnaps[index];
      QueryDocumentSnapshot<Map<String, dynamic>>? occupying;
      for (final guardianDoc in guardiansSnap.docs) {
        final status =
            guardianDoc.data()[FirestoreFields.status] as String? ?? '';
        if (status == GuardianStatuses.active ||
            status == GuardianStatuses.pending) {
          occupying = guardianDoc;
          break;
        }
      }
      if (occupying != null) {
        occupyingByMemberIndex[index] = occupying;
        parentUids.add(occupying.id);
      }
    }

    // Users parents en parallèle (uids uniques).
    final usersById = <String, Map<String, dynamic>>{};
    if (parentUids.isNotEmpty) {
      final userSnaps = await Future.wait(
        parentUids.map(
          (uid) => _db.collection(ProjectConfig.usersCollection).doc(uid).get(),
        ),
      );
      for (final userSnap in userSnaps) {
        if (userSnap.exists && userSnap.data() != null) {
          usersById[userSnap.id] = userSnap.data()!;
        }
      }
    }

    final byKey = <String, _ParentAccumulator>{};

    void ensure(
      String key, {
      String? parentUid,
      String? email,
      String? firstName,
      String? lastName,
      String? displayName,
      String? avatarUrl,
    }) {
      final existing = byKey[key];
      if (existing == null) {
        byKey[key] = _ParentAccumulator(
          parentUid: parentUid,
          email: email,
          firstName: firstName,
          lastName: lastName,
          displayName: displayName ?? email ?? 'Parent',
          avatarUrl: avatarUrl,
        );
        return;
      }
      existing.parentUid ??= parentUid;
      existing.email ??= email;
      existing.firstName ??= firstName;
      existing.lastName ??= lastName;
      existing.avatarUrl ??= avatarUrl;
      if ((existing.displayName.isEmpty || existing.displayName == 'Parent') &&
          displayName != null &&
          displayName.isNotEmpty) {
        existing.displayName = displayName;
      }
    }

    for (var index = 0; index < membersSnap.docs.length; index++) {
      final memberDoc = membersSnap.docs[index];
      final member = membersById[memberDoc.id]!;
      final childName = member.fullName.trim().isNotEmpty
          ? member.fullName.trim()
          : 'Enfant';
      final pendingInvite = pendingGuardianByMember[member.memberId];
      final inviteData = pendingInvite?.data();
      final occupying = occupyingByMemberIndex[index];

      if (occupying != null) {
        final statusRaw =
            occupying.data()[FirestoreFields.status] as String? ??
                GuardianStatuses.pending;
        final status = statusRaw == GuardianStatuses.active
            ? GuardianStatuses.active
            : GuardianStatuses.pending;

        String displayName = '';
        String? email;
        String? avatarUrl;
        String? firstName;
        String? lastName;
        final user = usersById[occupying.id];
        if (user != null) {
          firstName = (user[FirestoreFields.firstName] as String?)?.trim();
          lastName = (user[FirestoreFields.lastName] as String?)?.trim();
          displayName =
              (user[FirestoreFields.displayName] as String?)?.trim() ?? '';
          if (displayName.isEmpty) {
            displayName = '${firstName ?? ''} ${lastName ?? ''}'.trim();
          }
          email = user[FirestoreFields.email] as String?;
          avatarUrl = user[FirestoreFields.avatarUrl] as String?;
        }
        if (displayName.isEmpty) displayName = 'Parent';

        final expiresAt =
            (inviteData?[FirestoreFields.expiresAt] as Timestamp?)?.toDate();
        email ??= (inviteData?[FirestoreFields.email] as String?)?.trim();

        final key = 'uid:${occupying.id}';
        ensure(
          key,
          parentUid: occupying.id,
          email: email,
          firstName: firstName,
          lastName: lastName,
          displayName: displayName,
          avatarUrl: avatarUrl,
        );
        byKey[key]!.children.add(
          ClubParentChildRef(
            memberId: member.memberId,
            displayName: childName,
            status: status,
            parentUid: occupying.id,
            invitationId: pendingInvite?.id,
            invitationCode:
                (inviteData?[FirestoreFields.code] as String?)?.trim(),
            expiresAt: expiresAt,
          ),
        );
        continue;
      }

      if (pendingInvite == null || inviteData == null) continue;

      final email =
          (inviteData[FirestoreFields.email] as String?)?.trim().toLowerCase();
      if (email == null || email.isEmpty) continue;
      final expiresAt =
          (inviteData[FirestoreFields.expiresAt] as Timestamp?)?.toDate();
      final key = 'email:$email';
      ensure(key, email: email, displayName: email);
      byKey[key]!.children.add(
        ClubParentChildRef(
          memberId: member.memberId,
          displayName: childName,
          status: GuardianStatuses.pending,
          invitationId: pendingInvite.id,
          invitationCode: (inviteData[FirestoreFields.code] as String?)?.trim(),
          expiresAt: expiresAt,
        ),
      );
    }

    final entries = <ClubParentEntry>[];
    for (final entry in byKey.entries) {
      final acc = entry.value;
      final hasActive = acc.children.any(
        (c) => c.status == GuardianStatuses.active,
      );
      final status =
          hasActive ? GuardianStatuses.active : GuardianStatuses.pending;
      ClubMember? roster;
      if (acc.parentUid != null) {
        roster = membersByAccount[acc.parentUid!] ??
            membersById[acc.parentUid!];
      }
      entries.add(
        ClubParentEntry(
          rowKey: entry.key,
          parentUid: acc.parentUid,
          displayName: acc.displayName,
          firstName: acc.firstName,
          lastName: acc.lastName,
          avatarUrl: acc.avatarUrl,
          email: acc.email,
          status: status,
          children: acc.children,
          rosterMemberId: roster?.memberId,
        ),
      );
    }

    entries.sort(
      (a, b) =>
          a.displayName.toLowerCase().compareTo(b.displayName.toLowerCase()),
    );
    return entries;
  }

  /// Numéro de licence (`playerInfo.license`) d’une fiche membre.
  Future<String> getMemberLicense({
    required String clubId,
    required String memberId,
  }) async {
    final memberSnap = await _members(clubId).doc(memberId).get();
    if (!memberSnap.exists) return '';
    final data = memberSnap.data() ?? {};
    final playerInfo =
        data[FirestoreFields.playerInfo] as Map<String, dynamic>?;
    if (playerInfo == null) return '';
    return (playerInfo[FirestoreFields.license] as String?)?.trim() ?? '';
  }

  String inviteMessageFor({
    required Club club,
    required ClubInvitation invitation,
  }) =>
      buildInviteMessage(club: club, invitation: invitation);
}

class _ParentAccumulator {
  _ParentAccumulator({
    this.parentUid,
    this.email,
    this.firstName,
    this.lastName,
    required this.displayName,
    this.avatarUrl,
  });

  String? parentUid;
  String? email;
  String? firstName;
  String? lastName;
  String displayName;
  String? avatarUrl;
  final children = <ClubParentChildRef>[];
}
