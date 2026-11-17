/// Catalogue des droits club.
///
/// Seule la liste `members/{id}.permissions` fait foi. Les fonctions
/// ([ClubFunction]) ne sont que des raccourcis qui calculent cette liste. Source canonique partagée avec les
/// Functions et le portail : `shared/permissions_catalog.json` (parité testée).
library;

/// Droit club, dans l'ordre canonique du catalogue.
enum ClubPermission {
  /// Droit protégé : implique tous les autres et permet seul d'en attribuer.
  admin('admin'),
  manageMembers('manageMembers'),
  manageTeams('manageTeams'),
  manageEvents('manageEvents'),
  manageAnnouncements('manageAnnouncements'),
  manageFees('manageFees'),
  viewFees('viewFees'),
  manageClubSettings('manageClubSettings'),
  manageEquipment('manageEquipment'),
  manageChat('manageChat'),
  viewActivity('viewActivity');

  const ClubPermission(this.id);

  /// Identifiant stocké dans Firestore.
  final String id;

  /// Droits accordés d'office par ce droit.
  Set<ClubPermission> get implied => switch (this) {
    ClubPermission.manageFees => const {ClubPermission.viewFees},
    _ => const {},
  };

  /// Droit du catalogue pour [id], ou `null` s'il est inconnu.
  static ClubPermission? fromId(Object? id) {
    for (final permission in values) {
      if (permission.id == id) return permission;
    }
    return null;
  }

  /// Droits connus d'une liste Firestore (identifiants inconnus ignorés).
  static Set<ClubPermission> parse(Object? raw) {
    if (raw is! Iterable) return const {};
    return {for (final item in raw) ?fromId(item)};
  }

  /// Liste normalisée telle qu'elle est stockée : sans doublon, dans l'ordre
  /// du catalogue, droits impliqués ajoutés, réduite à `[admin]` si présent.
  static List<ClubPermission> normalize(Iterable<ClubPermission> permissions) {
    final granted = <ClubPermission>{
      for (final permission in permissions) ...{
        permission,
        ...permission.implied,
      },
    };
    if (granted.contains(ClubPermission.admin)) {
      return const [ClubPermission.admin];
    }
    return [
      for (final permission in values)
        if (granted.contains(permission)) permission,
    ];
  }
}

/// Fonction prédéfinie : raccourci (groupe de droits club) proposé à
/// l'attribution. Être entraîneur d'une équipe se règle dans l'équipe
/// (`teams.coachIds`), pas ici.
enum ClubFunction {
  feesManager('feesManager', {
    ClubPermission.manageFees,
    ClubPermission.viewFees,
  }),
  announcementsManager('announcementsManager', {
    ClubPermission.manageAnnouncements,
  }),
  membersManager('membersManager', {
    ClubPermission.manageMembers,
    ClubPermission.manageTeams,
  }),
  sportsManager('sportsManager', {
    ClubPermission.manageEvents,
    ClubPermission.manageTeams,
  }),
  equipmentManager('equipmentManager', {ClubPermission.manageEquipment});

  const ClubFunction(this.id, this.permissions);

  final String id;
  final Set<ClubPermission> permissions;

  /// `true` si [granted] contient tous les droits de la fonction.
  bool isFullyGranted(Set<ClubPermission> granted) =>
      granted.contains(ClubPermission.admin) ||
      granted.containsAll(permissions);

  /// `true` si [granted] contient une partie seulement des droits.
  bool isPartiallyGranted(Set<ClubPermission> granted) =>
      !isFullyGranted(granted) && permissions.any(granted.contains);
}

/// Capacité d'un coach d'équipe (relation `teams.coachIds`) sur ses équipes,
/// réglée pour tout le club dans `clubs/{clubId}.coachPermissions`.
enum CoachFlag {
  canCreateEvents('canCreateEvents', defaultValue: true),
  canManageTeamRoster('canManageTeamRoster', defaultValue: true),
  canInvitePlayers('canInvitePlayers', defaultValue: true),
  canTakeAttendance('canTakeAttendance', defaultValue: true),
  canPublishTeamAnnouncements(
    'canPublishTeamAnnouncements',
    defaultValue: true,
  ),
  canEditMemberLicenses('canEditMemberLicenses', defaultValue: false),
  canEditMemberRsvp('canEditMemberRsvp', defaultValue: false);

  const CoachFlag(this.id, {required this.defaultValue});

  /// Clé dans la map Firestore `coachPermissions`.
  final String id;

  /// Valeur si la clé est absente (clubs existants).
  final bool defaultValue;
}

/// Badge affiché pour un membre, par priorité décroissante. L'identifiant
/// ([Enum.name]) est partagé avec les Functions et le portail.
enum MemberBadge { admin, coach, player, member }

/// Badges d'une fiche : Admin (droit `admin`), Entraîneur (coach d'au moins
/// une équipe), Joueur (dans un effectif). Ni droit admin ni équipe ⇒
/// `[member]` : la liste n'est jamais vide. Parent se déduit des liens, pas
/// de la fiche.
List<MemberBadge> derivedMemberBadges({
  required Set<ClubPermission> permissions,
  required List<String> coachTeamIds,
  required List<String> teamIds,
}) {
  final badges = [
    if (permissions.contains(ClubPermission.admin)) MemberBadge.admin,
    if (coachTeamIds.isNotEmpty) MemberBadge.coach,
    if (teamIds.any((teamId) => !coachTeamIds.contains(teamId)))
      MemberBadge.player,
  ];
  return badges.isEmpty ? const [MemberBadge.member] : badges;
}

/// Identifiant de badge écrit dans les conversations
/// (`participantProfiles[uid].role`, `lastSenderRole`) : un [MemberBadge]
/// ou `parent` (participant sans fiche).
abstract final class ChatBadgeIds {
  static const String member = 'member';
  static const String parent = 'parent';

  /// Identifiant du badge [badge].
  static String of(MemberBadge badge) => badge.name;

  /// Identifiants acceptés par les règles Firestore.
  static const List<String> all = ['admin', 'coach', 'player', member, parent];
}
