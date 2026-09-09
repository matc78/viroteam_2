import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'dart:typed_data';

import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club_setup/models/club_setup_draft.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_membership_summary.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/services/retour_user_service.dart';
import 'package:viro_team_v2/utils/cloud_callable.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';
import 'package:viro_team_v2/utils/person_data_format.dart';
import 'package:viro_team_v2/utils/season_end.dart';

class ClubService {
  ClubService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
    RetourUserService? retourUserService,
  })  : _db = firestore ?? appFirestore,
        _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'europe-west1'),
        _retourUser = retourUserService ?? RetourUserService(firestore: firestore);

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;
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
        FirestoreFields.city: formatCity(draft.city, required: true),
        FirestoreFields.postalCode: formatPostalCode(draft.postalCode),
        FirestoreFields.address: formatAddressLine(draft.address),
        if (draft.description.trim().isNotEmpty)
          FirestoreFields.description: draft.description.trim(),
        FirestoreFields.brandColorHex: draft.brandColorHex,
        FirestoreFields.practiceLocations: draft.practiceLocations
            .map((location) {
              final cityValue = location.city;
              final addressValue = location.address;
              return PracticeLocation(
                name: location.name,
                city: cityValue == null || cityValue.trim().isEmpty
                    ? null
                    : formatCity(cityValue),
                address: addressValue == null || addressValue.trim().isEmpty
                    ? null
                    : formatAddressLine(addressValue),
                category: location.category,
                categoryCustom: location.categoryCustom,
              ).toFirestoreMap();
            })
            .toList(),
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

    if (draft.logoBytes != null) {
      try {
        await updateClubLogo(
          clubId: clubRef.id,
          logoBytes: draft.logoBytes!,
        );
      } catch (_) {
        // Logo optionnel — ne bloque pas la création du club.
      }
    }

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

  /// Met à jour le logo du club via callable Admin (`uploadClubLogo`).
  Future<String> updateClubLogo({
    required String clubId,
    required Uint8List logoBytes,
    String contentType = 'image/jpeg',
  }) async {
    final callable =
        _functions.httpsCallable(cloudCallableName('uploadClubLogo'));
    final result = await callable.call(<String, dynamic>{
      'clubId': clubId,
      'imageBase64': base64Encode(logoBytes),
      'contentType': contentType,
    });
    final data = result.data;
    if (data is Map && data['logoUrl'] is String) {
      return data['logoUrl'] as String;
    }
    throw StateError('Réponse uploadClubLogo invalide');
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
