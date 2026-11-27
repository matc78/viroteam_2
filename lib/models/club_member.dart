import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_permission.dart';

class ClubMember {
  const ClubMember({
    required this.memberId,
    required this.status,
    this.permissions = const {},
    this.coachTeamIds = const [],
    this.accountUid,
    this.firstName,
    this.lastName,
    this.displayName,
    this.avatarUrl,
    this.email,
    this.teamIds = const [],
    this.joinedAt,
    this.activeInvitationId,
    this.pendingInviteCode,
    this.pendingInviteExpiresAt,
    this.hasLinkedAccount = false,
    this.dismissedAnnouncementIds = const [],
    this.profileBadgeId,
  });

  /// Id du document `members/{memberId}` : clé unique du membre (rosters,
  /// convocations, RSVP, cotisations…), égale à l'UID Auth une fois lié.
  final String memberId;

  /// UID Firebase Auth si le membre a créé son compte (== [memberId]).
  final String? accountUid;

  /// Droits club de la fiche (`permissions`), seule autorité. Écrits par
  /// les Functions uniquement.
  final Set<ClubPermission> permissions;

  /// Équipes entraînées (`coachTeamIds`, dérivé de `teams.coachIds`).
  final List<String> coachTeamIds;

  final String status;
  final String? firstName;
  final String? lastName;
  final String? displayName;
  final String? avatarUrl;
  final String? email;
  final List<String> teamIds;
  final DateTime? joinedAt;
  final String? activeInvitationId;
  final String? pendingInviteCode;
  final DateTime? pendingInviteExpiresAt;

  /// `true` si un compte utilisateur est lié (users.createdAt présent).
  final bool hasLinkedAccount;

  /// Annonces masquées par le membre sur la home (croix).
  final List<String> dismissedAnnouncementIds;

  /// Badge dénormalisé d'un profil de conversation ([ChatBadgeIds]), pour un
  /// participant dont la fiche n'est pas lisible (vue parent). `null` pour
  /// une vraie fiche : le badge se dérive alors de ses droits et équipes.
  final String? profileBadgeId;

  /// Identifiant de badge affiché dans le chat ([ChatBadgeIds]).
  String get chatBadgeId => profileBadgeId ?? ChatBadgeIds.of(primaryBadge);

  bool get isActive => status == 'active';

  /// Droit Administrateur (implique tous les autres).
  bool get isAdmin => permissions.contains(ClubPermission.admin);

  /// Badges dérivés, par priorité décroissante (jamais vide : `[member]` à
  /// défaut).
  List<MemberBadge> get badges => derivedMemberBadges(
        permissions: permissions,
        coachTeamIds: coachTeamIds,
        teamIds: teamIds,
      );

  /// Badge principal (bulle de chat, avatar) : Admin > Entraîneur > Joueur >
  /// Membre.
  MemberBadge get primaryBadge => badges.first;

  /// Encadrement : badge principal Admin ou Entraîneur (droit
  /// Administrateur ou coach d'au moins une équipe). Source unique pour
  /// séparer l'encadrement des joueurs (listes, « Mon parent »…).
  bool get hasStaffBadge => switch (primaryBadge) {
        MemberBadge.admin || MemberBadge.coach => true,
        MemberBadge.player || MemberBadge.member => false,
      };

  /// Nombre de droits club stockés sur la fiche (résumé « n droits »).
  int get permissionCount => permissions.length;

  String get fullName {
    if (firstName != null || lastName != null) {
      return '${firstName ?? ''} ${lastName ?? ''}'.trim();
    }
    return displayName ?? '';
  }

  /// Prénom affiché (invites parent, puces famille) — firstName ou 1er token.
  String get preferredFirstName {
    final first = firstName?.trim() ?? '';
    if (first.isNotEmpty) return first;
    final display = fullName.trim();
    if (display.isNotEmpty) return display.split(' ').first;
    return AppCopy.common.childFallback;
  }

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      return parts.first.isNotEmpty ? parts.first[0].toUpperCase() : '?';
    }
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  bool get hasPendingInvite =>
      pendingInviteCode != null &&
      pendingInviteCode!.isNotEmpty &&
      (pendingInviteExpiresAt == null ||
          !DateTime.now().isAfter(pendingInviteExpiresAt!));

  /// Éligible à un e-mail d’invitation : pas encore de compte + e-mail renseigné.
  bool get canReceiveInviteEmail =>
      !hasLinkedAccount && (email?.trim().isNotEmpty ?? false);

  /// Joueur invité sans compte (`pending_members`) affiché dans un roster.
  factory ClubMember.fromPendingRoster({
    required String pendingId,
    required String firstName,
    required String lastName,
  }) {
    return ClubMember(
      memberId: pendingId,
      status: 'active',
      firstName: firstName,
      lastName: lastName,
      hasLinkedAccount: false,
    );
  }

  factory ClubMember.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? {};
    final snapshot =
        data[FirestoreFields.snapshot] as Map<String, dynamic>? ?? {};

    final firstName = data[FirestoreFields.firstName] as String?;
    final lastName = data[FirestoreFields.lastName] as String?;
    final snapshotName = snapshot[FirestoreFields.displayName] as String?;
    final displayName = snapshotName ??
        (firstName != null || lastName != null
            ? '${firstName ?? ''} ${lastName ?? ''}'.trim()
            : null);

    final accountUid = (data[FirestoreFields.accountUid] as String?)?.trim();

    return ClubMember(
      memberId: doc.id,
      accountUid:
          accountUid != null && accountUid.isNotEmpty ? accountUid : null,
      permissions: ClubPermission.parse(data[FirestoreFields.permissions]),
      coachTeamIds: (data[FirestoreFields.coachTeamIds] as List<dynamic>?)
              ?.whereType<String>()
              .toList() ??
          const [],
      status: data[FirestoreFields.status] as String? ?? 'active',
      firstName: firstName,
      lastName: lastName,
      displayName: displayName,
      avatarUrl: snapshot[FirestoreFields.avatarUrl] as String?,
      email: snapshot[FirestoreFields.email] as String?,
      teamIds: (data[FirestoreFields.teamIds] as List<dynamic>?)
              ?.whereType<String>()
              .toList() ??
          [],
      joinedAt: (data[FirestoreFields.joinedAt] as Timestamp?)?.toDate(),
      activeInvitationId: data[FirestoreFields.activeInvitationId] as String?,
      dismissedAnnouncementIds:
          (data[FirestoreFields.dismissedAnnouncementIds] as List<dynamic>?)
                  ?.whereType<String>()
                  .toList() ??
              [],
    );
  }

  ClubMember copyWith({
    bool? hasLinkedAccount,
    String? firstName,
    String? lastName,
    String? displayName,
    String? avatarUrl,
    String? email,
    String? pendingInviteCode,
    DateTime? pendingInviteExpiresAt,
    Set<ClubPermission>? permissions,
  }) {
    return ClubMember(
      memberId: memberId,
      accountUid: accountUid,
      permissions: permissions ?? this.permissions,
      coachTeamIds: coachTeamIds,
      status: status,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      displayName: displayName ?? this.displayName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      email: email ?? this.email,
      teamIds: teamIds,
      joinedAt: joinedAt,
      activeInvitationId: activeInvitationId,
      pendingInviteCode: pendingInviteCode ?? this.pendingInviteCode,
      pendingInviteExpiresAt:
          pendingInviteExpiresAt ?? this.pendingInviteExpiresAt,
      hasLinkedAccount: hasLinkedAccount ?? this.hasLinkedAccount,
      dismissedAnnouncementIds: dismissedAnnouncementIds,
      profileBadgeId: profileBadgeId,
    );
  }
}
