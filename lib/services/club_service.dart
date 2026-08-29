import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:typed_data';

import 'package:firebase_storage/firebase_storage.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club_setup/models/club_setup_draft.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_membership_summary.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/services/retour_user_service.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';
import 'package:viro_team_v2/utils/season_end.dart';

class ClubService {
  ClubService({
    FirebaseFirestore? firestore,
    FirebaseStorage? storage,
    RetourUserService? retourUserService,
  })  : _db = firestore ?? appFirestore,
        _storage = storage ?? FirebaseStorage.instance,
        _retourUser = retourUserService ?? RetourUserService(firestore: firestore);

  final FirebaseFirestore _db;
  final FirebaseStorage _storage;
  final RetourUserService _retourUser;

  CollectionReference<Map<String, dynamic>> get _clubs =>
      _db.collection(ProjectConfig.clubsCollection);

  Future<Club?> getClub(String clubId) async {
    final doc = await _clubs.doc(clubId).get();
    if (!doc.exists) return null;
    return Club.fromFirestore(doc);
  }

  /// Clubs où l’utilisateur est membre **ou** parent actif.
  Future<List<Club>> getClubsForUser(ViroUser user) async {
    final ids = <String>{
      ...user.clubMemberships.map((membership) => membership.clubId),
      ...user.activeParentLinks.map((link) => link.clubId),
    }.where((id) => id.isNotEmpty).toList();
    return getClubsByIds(ids);
  }

  Future<List<Club>> getClubsByIds(List<String> ids) async {
    if (ids.isEmpty) return [];

    final results = <Club>[];
    for (var i = 0; i < ids.length; i += 10) {
      final chunk = ids.skip(i).take(10).toList();
      final snap = await _clubs
          .where(FieldPath.documentId, whereIn: chunk)
          .get();
      results.addAll(snap.docs.map(Club.fromFirestore));
    }
    return results;
  }

  Future<String> createClubFromDraft({
    required String founderUid,
    required ViroUser founder,
    required ClubSetupDraft draft,
  }) async {
    final clubRef = _clubs.doc();
    final memberRef = clubRef
        .collection(ProjectConfig.membersSubcollection)
        .doc(founderUid);
    final userRef =
        _db.collection(ProjectConfig.usersCollection).doc(founderUid);

    String? logoUrl;
    if (draft.logoBytes != null) {
      try {
        final storageRef =
            _storage.ref().child('clubs/${clubRef.id}/logo.jpg');
        await storageRef.putData(
          draft.logoBytes!,
          SettableMetadata(contentType: 'image/jpeg'),
        );
        logoUrl = await storageRef.getDownloadURL();
      } catch (_) {
        // Logo optionnel — ne bloque pas la création du club.
      }
    }

    final displayName = founder.displayName.isNotEmpty
        ? founder.displayName
        : '${founder.firstName} ${founder.lastName}'.trim();

    await _db.runTransaction((tx) async {
      // Firestore : toutes les lectures avant les écritures.
      final userSnap = await tx.get(userRef);
      final data = userSnap.data() ?? {};
      final memberships = (data[FirestoreFields.clubMemberships]
                  as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          [];
      memberships.add(
        ClubMembershipSummary(
          clubId: clubRef.id,
          role: MemberRoles.admin,
        ).toMap(),
      );

      tx.set(clubRef, {
        FirestoreFields.name: draft.name.trim(),
        FirestoreFields.sport: draft.sport,
        FirestoreFields.city: draft.city.trim(),
        FirestoreFields.postalCode: draft.postalCode.trim(),
        FirestoreFields.address: draft.address.trim(),
        if (draft.description.trim().isNotEmpty)
          FirestoreFields.description: draft.description.trim(),
        if (logoUrl != null) FirestoreFields.logoUrl: logoUrl,
        FirestoreFields.brandColorHex: draft.brandColorHex,
        FirestoreFields.practiceLocations:
            draft.practiceLocations.map((l) => l.toMap()).toList(),
        FirestoreFields.adminIds: [founderUid],
        FirestoreFields.memberCount: 1,
        FirestoreFields.seasonEndDate: Timestamp.fromDate(defaultSeasonEndDate()),
        FirestoreFields.createdAt: FieldValue.serverTimestamp(),
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(memberRef, {
        FirestoreFields.memberId: founderUid,
        FirestoreFields.accountUid: founderUid,
        FirestoreFields.userId: founderUid,
        FirestoreFields.firstName: founder.firstName,
        FirestoreFields.lastName: founder.lastName,
        FirestoreFields.role: MemberRoles.admin,
        FirestoreFields.status: 'active',
        FirestoreFields.teamIds: <String>[],
        FirestoreFields.snapshot: {
          FirestoreFields.displayName: displayName,
          FirestoreFields.email: founder.email,
          if (founder.avatarUrl != null)
            FirestoreFields.avatarUrl: founder.avatarUrl,
        },
        FirestoreFields.joinedAt: FieldValue.serverTimestamp(),
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(
        userRef,
        {
          FirestoreFields.clubMemberships: memberships,
          FirestoreFields.flags: {
            FirestoreFields.profileCompleted: true,
            FirestoreFields.disabled: false,
          },
          FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
        },
        SetOptions(merge: true),
      );
    });

    try {
      await _retourUser.saveClubSetupObjectives(
        userId: founderUid,
        clubId: clubRef.id,
        objectiveKeys: draft.objectives,
        clubName: draft.name.trim(),
        clubSport: draft.sport,
        memberCountRange: draft.memberCountRange,
      );
    } catch (_) {
      // Objectifs déjà créés côté club ; retour_user optionnel si règles non déployées.
    }

    return clubRef.id;
  }

  /// Met à jour la couleur de marque du club (`brandColorHex`).
  Future<void> updateBrandColor({
    required String clubId,
    required String brandColorHex,
  }) async {
    await _clubs.doc(clubId).update({
      FirestoreFields.brandColorHex: brandColorHex,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }

  /// Met à jour le logo du club (upload Storage + URL Firestore).
  Future<String> updateClubLogo({
    required String clubId,
    required Uint8List logoBytes,
  }) async {
    final storageRef = _storage.ref().child('clubs/$clubId/logo.jpg');
    await storageRef.putData(
      logoBytes,
      SettableMetadata(contentType: 'image/jpeg'),
    );
    final logoUrl = await storageRef.getDownloadURL();
    await _clubs.doc(clubId).update({
      FirestoreFields.logoUrl: logoUrl,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
    return logoUrl;
  }

  /// Met à jour la config paiement en ligne HelloAsso du club.
  Future<void> updateOnlinePaymentConfig({
    required String clubId,
    required bool enabled,
    String? organizationSlug,
  }) async {
    final slug = organizationSlug?.trim();
    await _clubs.doc(clubId).update({
      FirestoreFields.onlinePaymentEnabled: enabled,
      if (slug != null && slug.isNotEmpty)
        FirestoreFields.helloAssoOrganizationSlug: slug
      else
        FirestoreFields.helloAssoOrganizationSlug: FieldValue.delete(),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }

  /// Met à jour la date de fin de saison sportive.
  Future<void> updateSeasonEndDate({
    required String clubId,
    required DateTime seasonEndDate,
  }) async {
    await _clubs.doc(clubId).update({
      FirestoreFields.seasonEndDate: Timestamp.fromDate(seasonEndDate),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }

  /// Met à jour les droits coachs configurables du club.
  Future<void> updateCoachPermissions({
    required String clubId,
    required CoachPermissions permissions,
  }) async {
    await _clubs.doc(clubId).update({
      FirestoreFields.coachPermissions: permissions.toMap(),
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
