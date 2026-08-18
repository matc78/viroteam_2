import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_invitation.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_membership_summary.dart';
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

class ClubParentEntry {
  const ClubParentEntry({
    required this.parentUid,
    required this.displayName,
    this.avatarUrl,
    this.email,
  });

  final String parentUid;
  final String displayName;
  final String? avatarUrl;
  final String? email;
}

class MemberService {
  MemberService({FirebaseFirestore? firestore})
      : _db = firestore ?? appFirestore;

  final FirebaseFirestore _db;

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

  Future<AddMemberResult> addMemberWithInvitation({
    required String clubId,
    required String firstName,
    required String lastName,
    required String role,
    required String sentByUid,
    required Club club,
  }) async {
    final trimmedFirst = firstName.trim();
    final trimmedLast = lastName.trim();
    if (trimmedFirst.isEmpty || trimmedLast.isEmpty) {
      throw ArgumentError('Le prénom et le nom sont obligatoires.');
    }
    if (role != MemberRoles.player && role != MemberRoles.coach) {
      throw ArgumentError('Seuls joueur et coach peuvent être ajoutés ici.');
    }

    final memberRef = _members(clubId).doc();
    final inviteRef = _invitations(clubId).doc();
    final clubRef =
        _db.collection(ProjectConfig.clubsCollection).doc(clubId);
    final code = generateInviteCode();
    final expiresAt = DateTime.now().add(const Duration(days: 7));
    final displayName = '$trimmedFirst $trimmedLast';

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
        FirestoreFields.snapshot: {
          FirestoreFields.displayName: displayName,
        },
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
        FirestoreFields.role: role,
        FirestoreFields.status: InvitationStatus.pending,
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

    final memberRef = _members(clubId).doc(memberId);
    final clubRef =
        _db.collection(ProjectConfig.clubsCollection).doc(clubId);

    await _db.runTransaction((tx) async {
      final memberSnap = await tx.get(memberRef);
      final clubSnap = await tx.get(clubRef);
      if (!memberSnap.exists) throw StateError('Membre introuvable.');

      final data = memberSnap.data()!;
      final oldRole = data[FirestoreFields.role] as String? ?? MemberRoles.player;
      final accountUid = data[FirestoreFields.accountUid] as String?;

      if (oldRole == MemberRoles.admin && newRole != MemberRoles.admin) {
        final adminIds = (clubSnap.data()?[FirestoreFields.adminIds]
                    as List<dynamic>?)
                ?.whereType<String>()
                .toList() ??
            [];
        if (adminIds.length <= 1 && adminIds.contains(accountUid ?? memberId)) {
          throw StateError('Impossible de retirer le dernier administrateur.');
        }
      }

      tx.update(memberRef, {
        FirestoreFields.role: newRole,
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });

      final adminIds = (clubSnap.data()?[FirestoreFields.adminIds]
                  as List<dynamic>?)
              ?.whereType<String>()
              .toList() ??
          [];
      var updatedAdminIds = List<String>.from(adminIds);

      if (accountUid != null) {
        if (newRole == MemberRoles.admin &&
            !updatedAdminIds.contains(accountUid)) {
          updatedAdminIds.add(accountUid);
        } else if (oldRole == MemberRoles.admin &&
            newRole != MemberRoles.admin) {
          updatedAdminIds.remove(accountUid);
        }

        if (updatedAdminIds != adminIds) {
          tx.update(clubRef, {
            FirestoreFields.adminIds: updatedAdminIds,
            FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
          });
        }

        final userRef =
            _db.collection(ProjectConfig.usersCollection).doc(accountUid);
        final userSnap = await tx.get(userRef);
        if (userSnap.exists) {
          final userData = userSnap.data() ?? {};
          final memberships = (userData[FirestoreFields.clubMemberships]
                      as List<dynamic>?)
                  ?.whereType<Map<String, dynamic>>()
                  .toList() ??
              [];
          for (var i = 0; i < memberships.length; i++) {
            if (memberships[i][FirestoreFields.clubId] == clubId) {
              memberships[i] = ClubMembershipSummary(
                clubId: clubId,
                role: newRole,
              ).toMap();
              break;
            }
          }
          tx.update(userRef, {
            FirestoreFields.clubMemberships: memberships,
            FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    });
  }

  Future<void> removeMember({
    required String clubId,
    required String memberId,
  }) async {
    final memberRef = _members(clubId).doc(memberId);
    final clubRef =
        _db.collection(ProjectConfig.clubsCollection).doc(clubId);

    await _db.runTransaction((tx) async {
      final memberSnap = await tx.get(memberRef);
      final clubSnap = await tx.get(clubRef);
      if (!memberSnap.exists) return;

      final data = memberSnap.data()!;
      final role = data[FirestoreFields.role] as String? ?? MemberRoles.player;
      if (role == MemberRoles.admin) {
        throw StateError('Impossible de supprimer un administrateur.');
      }

      final accountUid = data[FirestoreFields.accountUid] as String?;
      final inviteId = data[FirestoreFields.activeInvitationId] as String?;

      tx.delete(memberRef);

      final memberCount =
          (clubSnap.data()?[FirestoreFields.memberCount] as num?)?.toInt() ?? 0;
      tx.update(clubRef, {
        FirestoreFields.memberCount: memberCount > 0 ? memberCount - 1 : 0,
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });

      if (inviteId != null) {
        final inviteRef = _invitations(clubId).doc(inviteId);
        final inviteSnap = await tx.get(inviteRef);
        if (inviteSnap.exists &&
            inviteSnap.data()?[FirestoreFields.status] ==
                InvitationStatus.pending) {
          tx.update(inviteRef, {
            FirestoreFields.status: InvitationStatus.expired,
            FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      if (accountUid != null) {
        final userRef =
            _db.collection(ProjectConfig.usersCollection).doc(accountUid);
        final userSnap = await tx.get(userRef);
        if (userSnap.exists) {
          final userData = userSnap.data() ?? {};
          final memberships = (userData[FirestoreFields.clubMemberships]
                      as List<dynamic>?)
                  ?.whereType<Map<String, dynamic>>()
                  .toList() ??
              [];
          memberships.removeWhere((m) => m[FirestoreFields.clubId] == clubId);
          tx.update(userRef, {
            FirestoreFields.clubMemberships: memberships,
            FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
          });
        }

        final accountIndexRef = clubRef
            .collection(ProjectConfig.memberAccountsSubcollection)
            .doc(accountUid);
        final indexSnap = await tx.get(accountIndexRef);
        if (indexSnap.exists) {
          tx.delete(accountIndexRef);
        }
      }
    });
  }

  /// Parents liés aux fiches du club via `members/{memberId}/guardians`.
  ///
  /// Source de vérité : sous-collection guardians (pas le scan legacy
  /// `users.parentLinks.childUid`).
  Future<List<ClubParentEntry>> fetchClubParents(String clubId) async {
    final membersSnap = await _members(clubId).get();
    final seenParentUids = <String>{};
    final entries = <ClubParentEntry>[];

    for (final memberDoc in membersSnap.docs) {
      final guardiansSnap = await memberDoc.reference
          .collection(ProjectConfig.guardiansSubcollection)
          .get();
      for (final guardianDoc in guardiansSnap.docs) {
        final status =
            guardianDoc.data()[FirestoreFields.status] as String? ?? '';
        if (status != GuardianStatuses.active &&
            status != GuardianStatuses.pending) {
          continue;
        }
        final parentUid = guardianDoc.id;
        if (!seenParentUids.add(parentUid)) continue;

        String displayName = '';
        String? email;
        String? avatarUrl;
        final userSnap = await _db
            .collection(ProjectConfig.usersCollection)
            .doc(parentUid)
            .get();
        if (userSnap.exists) {
          final user = userSnap.data()!;
          displayName =
              (user[FirestoreFields.displayName] as String?)?.trim() ?? '';
          if (displayName.isEmpty) {
            displayName =
                '${user[FirestoreFields.firstName] ?? ''} ${user[FirestoreFields.lastName] ?? ''}'
                    .trim();
          }
          email = user[FirestoreFields.email] as String?;
          avatarUrl = user[FirestoreFields.avatarUrl] as String?;
        }
        if (displayName.isEmpty) displayName = 'Parent';

        entries.add(
          ClubParentEntry(
            parentUid: parentUid,
            displayName: displayName,
            avatarUrl: avatarUrl,
            email: email,
          ),
        );
      }
    }

    entries.sort(
      (a, b) =>
          a.displayName.toLowerCase().compareTo(b.displayName.toLowerCase()),
    );
    return entries;
  }

  String inviteMessageFor({
    required Club club,
    required ClubInvitation invitation,
  }) =>
      buildInviteMessage(club: club, invitation: invitation);
}
