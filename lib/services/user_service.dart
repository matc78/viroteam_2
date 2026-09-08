import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_membership_summary.dart';
import 'package:viro_team_v2/models/notification_preferences.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/utils/email_validation.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';
import 'package:viro_team_v2/utils/person_data_format.dart';

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
    final normalizedEmail = normalizeEmail(user.email);
    final formattedFirst = _formatOptionalFirstName(user.firstName);
    final formattedLast = _formatOptionalLastName(user.lastName);
    final displayName = [
      formattedFirst,
      formattedLast,
    ].where((part) => part.isNotEmpty).join(' ');
    final formatted = ViroUser(
      uid: user.uid,
      email: normalizedEmail,
      emailNorm: normalizedEmail,
      firstName: formattedFirst,
      lastName: formattedLast,
      displayName: displayName.isNotEmpty ? displayName : user.displayName.trim(),
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      clubMemberships: user.clubMemberships,
      parentLinks: user.parentLinks,
      parentClubIds: user.parentClubIds,
      profileCompleted: user.profileCompleted,
      disabled: user.disabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    );
    await _userRef(user.uid).set(formatted.toCreateMap());
  }

  /// Crée un profil Firestore minimal si l'utilisateur Auth n'en a pas encore.
  ///
  /// Utile après connexion (compte Auth existant sans fiche `users/{uid}` en prod).
  Future<ViroUser> ensureUserProfileFromAuth(
    User firebaseUser, {
    String? firstName,
    String? lastName,
  }) async {
    final existingProfile = await getUser(firebaseUser.uid);
    if (existingProfile != null) return existingProfile;

    final email = normalizeEmail(firebaseUser.email ?? '');
    final parsedName = _splitDisplayName(firebaseUser.displayName);
    final resolvedFirst = _softFormatFirstName(
      firstName?.trim().isNotEmpty == true ? firstName! : parsedName.$1,
    );
    final resolvedLast = _softFormatLastName(
      lastName?.trim().isNotEmpty == true ? lastName! : parsedName.$2,
    );
    final displayName = [
      resolvedFirst,
      resolvedLast,
    ].where((part) => part.isNotEmpty).join(' ');

    final profile = ViroUser(
      uid: firebaseUser.uid,
      email: email,
      emailNorm: email,
      firstName: resolvedFirst,
      lastName: resolvedLast,
      displayName: displayName,
      profileCompleted: false,
    );
    await createUserProfile(profile);
    return profile;
  }

  (String, String) _splitDisplayName(String? displayName) {
    final trimmed = displayName?.trim() ?? '';
    if (trimmed.isEmpty) return ('', '');

    final parts = trimmed.split(RegExp(r'\s+'));
    if (parts.length == 1) return (parts.first, '');

    return (parts.first, parts.sublist(1).join(' '));
  }

  /// Met à jour le profil utilisateur (prénom, nom, téléphone).
  Future<void> updateProfile({
    required String uid,
    required String firstName,
    required String lastName,
    String? phone,
  }) async {
    final formattedFirst = _formatOptionalFirstName(firstName);
    final formattedLast = _formatOptionalLastName(lastName);
    if (formattedFirst.isEmpty && formattedLast.isEmpty) {
      throw ArgumentError('Indique au moins un prénom ou un nom.');
    }
    final displayName = [formattedFirst, formattedLast]
        .where((part) => part.isNotEmpty)
        .join(' ');

    final update = <String, dynamic>{
      FirestoreFields.firstName: formattedFirst,
      FirestoreFields.lastName: formattedLast,
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

  /// Persiste les préférences de notifications push.
  Future<void> updateNotificationPreferences({
    required String uid,
    required NotificationPreferences preferences,
  }) async {
    await _userRef(uid).set(
      {
        FirestoreFields.notificationPreferences: preferences.toMap(),
        FirestoreFields.updatedAt: FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );
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

  /// Formate un prénom ; vide si entrée vide ; rejette les caractères interdits.
  String _formatOptionalFirstName(String raw) {
    if (raw.trim().isEmpty) return '';
    return formatFirstName(raw);
  }

  /// Formate un nom ; vide si entrée vide ; rejette les caractères interdits.
  String _formatOptionalLastName(String raw) {
    if (raw.trim().isEmpty) return '';
    return formatLastName(raw);
  }

  /// Formate un prénom OAuth ; ignore les valeurs invalides (profil incomplet).
  String _softFormatFirstName(String raw) {
    try {
      return _formatOptionalFirstName(raw);
    } on ArgumentError {
      return '';
    }
  }

  /// Formate un nom OAuth ; ignore les valeurs invalides (profil incomplet).
  String _softFormatLastName(String raw) {
    try {
      return _formatOptionalLastName(raw);
    } on ArgumentError {
      return '';
    }
  }
}
