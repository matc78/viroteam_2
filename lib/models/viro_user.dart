import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/constants/legal_terms.dart';
import 'package:viro_team_v2/models/notification_preferences.dart';
import 'package:viro_team_v2/models/parent_link.dart';

class ViroUser {
  const ViroUser({
    required this.uid,
    required this.email,
    required this.emailNorm,
    required this.firstName,
    required this.lastName,
    required this.displayName,
    this.phone,
    this.avatarUrl,
    this.memberClubIds = const [],
    this.parentLinks = const [],
    this.parentClubIds = const [],
    this.notificationPreferences = NotificationPreferences.defaults,
    this.profileCompleted = false,
    this.disabled = false,
    this.chatMessaging = false,
    this.termsAcceptedAt,
    this.termsVersion,
    this.createdAt,
    this.updatedAt,
  });

  final String uid;
  final String email;
  final String emailNorm;
  final String firstName;
  final String lastName;
  final String displayName;
  final String? phone;
  final String? avatarUrl;

  /// Clubs où le compte a une fiche membre (`memberClubIds`, écrit par les
  /// Functions).
  final List<String> memberClubIds;
  final List<ParentLink> parentLinks;
  final List<String> parentClubIds;
  final NotificationPreferences notificationPreferences;
  final bool profileCompleted;
  final bool disabled;

  /// Accès anticipé messagerie (`flags.chatMessaging`), posé en console.
  final bool chatMessaging;
  final DateTime? termsAcceptedAt;
  final String? termsVersion;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Clubs accessibles : adhésion **ou** lien parent actif.
  bool get hasClubs =>
      memberClubIds.isNotEmpty || activeParentLinks.isNotEmpty;

  /// Liens parent actifs (espace famille).
  List<ParentLink> get activeParentLinks =>
      parentLinks.where((link) => link.isActive).toList();

  /// Liens parent actifs dans un club.
  List<ParentLink> activeParentLinksInClub(String clubId) =>
      activeParentLinks.where((link) => link.clubId == clubId).toList();

  /// `true` si l’adulte a une fiche membre dans ce club.
  bool isLicensedInClub(String clubId) => memberClubIds.contains(clubId);

  /// `true` si l'utilisateur n'est que parent dans ce club (lien actif, pas de
  /// fiche membre) : ses lectures Firestore sont limitées aux équipes de ses
  /// enfants (`parentTeamIds`).
  bool isGuardianOnlyInClub(String clubId) =>
      !isLicensedInClub(clubId) && activeParentLinksInClub(clubId).isNotEmpty;

  factory ViroUser.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    final flags = data[FirestoreFields.flags] as Map<String, dynamic>? ?? {};
    final legal = data[FirestoreFields.legal] as Map<String, dynamic>? ?? {};
    final memberClubIdsRaw =
        data[FirestoreFields.memberClubIds] as List<dynamic>? ?? [];
    final parentLinksRaw =
        data[FirestoreFields.parentLinks] as List<dynamic>? ?? [];
    final parentClubIdsRaw =
        data[FirestoreFields.parentClubIds] as List<dynamic>? ?? [];

    return ViroUser(
      uid: data[FirestoreFields.uid] as String? ?? doc.id,
      email: data[FirestoreFields.email] as String? ?? '',
      emailNorm: data[FirestoreFields.emailNorm] as String? ?? '',
      firstName: data[FirestoreFields.firstName] as String? ?? '',
      lastName: data[FirestoreFields.lastName] as String? ?? '',
      displayName: data[FirestoreFields.displayName] as String? ?? '',
      phone: data[FirestoreFields.phone] as String?,
      avatarUrl: data[FirestoreFields.avatarUrl] as String?,
      memberClubIds: memberClubIdsRaw
          .whereType<String>()
          .where((id) => id.isNotEmpty)
          .toList(),
      parentLinks: parentLinksRaw
          .whereType<Map<String, dynamic>>()
          .map(ParentLink.fromMap)
          .where((link) => link.clubId.isNotEmpty && link.memberId.isNotEmpty)
          .toList(),
      parentClubIds: parentClubIdsRaw
          .map((item) => item.toString())
          .where((id) => id.isNotEmpty)
          .toList(),
      notificationPreferences: NotificationPreferences.fromMap(
        data[FirestoreFields.notificationPreferences] as Map<String, dynamic>?,
      ),
      profileCompleted:
          flags[FirestoreFields.profileCompleted] as bool? ?? false,
      disabled: flags[FirestoreFields.disabled] as bool? ?? false,
      chatMessaging: flags[FirestoreFields.chatMessaging] as bool? ?? false,
      termsAcceptedAt:
          (legal[FirestoreFields.termsAcceptedAt] as Timestamp?)?.toDate(),
      termsVersion: legal[FirestoreFields.termsVersion] as String?,
      createdAt: (data[FirestoreFields.createdAt] as Timestamp?)?.toDate(),
      updatedAt: (data[FirestoreFields.updatedAt] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toCreateMap() {
    final now = FieldValue.serverTimestamp();
    return {
      FirestoreFields.uid: uid,
      FirestoreFields.email: email,
      FirestoreFields.emailNorm: emailNorm,
      FirestoreFields.firstName: firstName,
      FirestoreFields.lastName: lastName,
      FirestoreFields.displayName: displayName,
      if (phone != null) FirestoreFields.phone: phone,
      FirestoreFields.memberClubIds: <String>[],
      FirestoreFields.parentLinks: <Map<String, dynamic>>[],
      FirestoreFields.parentClubIds: <String>[],
      FirestoreFields.flags: {
        FirestoreFields.profileCompleted: profileCompleted,
        FirestoreFields.disabled: disabled,
      },
      FirestoreFields.legal: {
        FirestoreFields.termsAcceptedAt: now,
        FirestoreFields.termsVersion: LegalTerms.currentVersion,
      },
      FirestoreFields.createdAt: now,
      FirestoreFields.updatedAt: now,
    };
  }
}
