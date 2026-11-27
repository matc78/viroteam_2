import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/team_federation.dart';

class ClubTeam {
  const ClubTeam({
    required this.id,
    required this.clubId,
    required this.name,
    this.category,
    this.avatarUrl,
    this.playerIds = const [],
    this.coachIds = const [],
    this.pendingPlayerIds = const [],
    this.sparringIds = const [],
    this.messagingLink,
    this.parentsMessagingLink,
    this.federation,
  });

  final String id;
  final String clubId;
  final String name;
  final String? category;
  final String? avatarUrl;
  final List<String> playerIds;
  final List<String> coachIds;
  final List<String> pendingPlayerIds;

  /// Joueurs sparrings (sous-ensemble de [playerIds]) : non convoqués par
  /// défaut aux matchs, ajoutables à la main.
  final List<String> sparringIds;
  final String? messagingLink;
  final String? parentsMessagingLink;

  /// Lien vers la poule fédérale (calendrier + classement), écrit par les Functions.
  final TeamFederationLink? federation;

  String get categoryLabel =>
      (category != null && category!.isNotEmpty) ? category! : 'Sans catégorie';

  /// `true` si [member] est sur le roster joueurs (clé = id de la fiche).
  bool isOnPlayerRoster(ClubMember member) =>
      playerIds.contains(member.memberId);

  /// `true` si [member] est sur le roster coachs (clé = id de la fiche).
  bool isOnCoachRoster(ClubMember member) => coachIds.contains(member.memberId);

  bool isPendingOnRoster(String pendingId) =>
      pendingPlayerIds.contains(pendingId);

  /// `true` si le joueur [memberId] (id de fiche) est sparring de l'équipe.
  bool isSparring(String memberId) =>
      sparringIds.contains(memberId) && playerIds.contains(memberId);

  factory ClubTeam.fromFirestore({
    required String clubId,
    required DocumentSnapshot<Map<String, dynamic>> doc,
  }) {
    final data = doc.data() ?? {};
    return ClubTeam(
      id: doc.id,
      clubId: clubId,
      name: data[FirestoreFields.name] as String? ?? 'Équipe sans nom',
      category: data[FirestoreFields.category] as String?,
      avatarUrl: data[FirestoreFields.avatarUrl] as String?,
      playerIds: (data[FirestoreFields.playerIds] as List<dynamic>?)
              ?.whereType<String>()
              .toList() ??
          [],
      coachIds: (data[FirestoreFields.coachIds] as List<dynamic>?)
              ?.whereType<String>()
              .toList() ??
          [],
      pendingPlayerIds:
          (data[FirestoreFields.pendingPlayerIds] as List<dynamic>?)
                  ?.whereType<String>()
                  .toList() ??
              [],
      sparringIds: (data[FirestoreFields.sparringIds] as List<dynamic>?)
              ?.whereType<String>()
              .toList() ??
          [],
      messagingLink: (data[FirestoreFields.messagingLink] as String?)?.trim(),
      parentsMessagingLink:
          (data[FirestoreFields.parentsMessagingLink] as String?)?.trim(),
      federation: TeamFederationLink.fromMap(data[FirestoreFields.federation]),
    );
  }
}

/// Profil affiché pour un membre d'équipe (compte lié).
class TeamMemberProfile {
  const TeamMemberProfile({
    required this.uid,
    required this.displayName,
    this.firstName,
    this.lastName,
    this.avatarUrl,
  });

  final String uid;
  final String displayName;
  final String? firstName;
  final String? lastName;
  final String? avatarUrl;

  String get initials {
    final parts = displayName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

/// Joueur invité sans compte utilisateur.
class PendingTeamMember {
  const PendingTeamMember({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.email,
  });

  final String id;
  final String firstName;
  final String lastName;
  final String? email;

  String get fullName => '$firstName $lastName'.trim();
}
