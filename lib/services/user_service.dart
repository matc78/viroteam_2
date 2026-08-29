import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_membership_summary.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

class UserService {
  UserService({FirebaseFirestore? firestore})
      : _db = firestore ?? appFirestore;

  final FirebaseFirestore _db;

  DocumentReference<Map<String, dynamic>> _userRef(String uid) =>
      _db.collection(ProjectConfig.usersCollection).doc(uid);

  Stream<ViroUser?> watchUser(String uid) {
    return _userRef(uid).snapshots().map((doc) {
      if (!doc.exists) return null;
      return ViroUser.fromFirestore(doc);
    });
  }

  Future<ViroUser?> getUser(String uid) async {
    final doc = await _userRef(uid).get();
    if (!doc.exists) return null;
    return ViroUser.fromFirestore(doc);
  }

  Future<void> createUserProfile(ViroUser user) async {
    await _userRef(user.uid).set(user.toCreateMap());
  }

  /// Met à jour le profil utilisateur (prénom, nom, téléphone).
  Future<void> updateProfile({
    required String uid,
    required String firstName,
    required String lastName,
    String? phone,
  }) async {
    final trimmedFirst = firstName.trim();
    final trimmedLast = lastName.trim();
    final displayName =
        [trimmedFirst, trimmedLast].where((part) => part.isNotEmpty).join(' ');

    final update = <String, dynamic>{
      FirestoreFields.firstName: trimmedFirst,
      FirestoreFields.lastName: trimmedLast,
      FirestoreFields.displayName: displayName,
      FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
    };
    final trimmedPhone = phone?.trim();
    if (trimmedPhone != null && trimmedPhone.isNotEmpty) {
      update[FirestoreFields.phone] = trimmedPhone;
    } else {
      update[FirestoreFields.phone] = FieldValue.delete();
    }

    await _userRef(uid).set(update, SetOptions(merge: true));
  }

  /// Met à jour l’avatar utilisateur et sync la fiche membre du club actif.
  Future<void> updateAvatarUrl({
    required String uid,
    required String avatarUrl,
    String? syncMemberClubId,
  }) async {
    await _userRef(uid).set(
      {
        FirestoreFields.avatarUrl: avatarUrl,
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );

    final clubId = syncMemberClubId?.trim();
    if (clubId == null || clubId.isEmpty) return;

    try {
      final memberRef = _db
          .collection(ProjectConfig.clubsCollection)
          .doc(clubId)
          .collection(ProjectConfig.membersSubcollection)
          .doc(uid);
      final memberSnap = await memberRef.get();
      if (!memberSnap.exists) return;

      final data = memberSnap.data() ?? {};
      final existingSnapshot =
          data[FirestoreFields.snapshot] as Map<String, dynamic>? ?? {};
      await memberRef.set(
        {
          FirestoreFields.snapshot: {
            ...existingSnapshot,
            FirestoreFields.avatarUrl: avatarUrl,
          },
          FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
        },
        SetOptions(merge: true),
      );
    } catch (_) {
      // Sync membre best-effort — ne bloque pas l’avatar user.
    }
  }

  Future<void> addClubMembership({
    required String uid,
    required String clubId,
    required String role,
    bool profileCompleted = true,
  }) async {
    final ref = _userRef(uid);
    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      final data = snap.data() ?? {};
      final existing = (data[FirestoreFields.clubMemberships] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          [];

      final alreadyMember = existing.any(
        (m) => m[FirestoreFields.clubId] == clubId,
      );
      if (!alreadyMember) {
        existing.add(
          ClubMembershipSummary(clubId: clubId, role: role).toMap(),
        );
      }

      tx.set(
        ref,
        {
          FirestoreFields.clubMemberships: existing,
          FirestoreFields.flags: {
            FirestoreFields.profileCompleted: profileCompleted,
            FirestoreFields.disabled: false,
          },
          FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
        },
        SetOptions(merge: true),
      );
    });
  }
}
