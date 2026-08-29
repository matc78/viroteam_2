import 'package:viro_team_v2/constants/firestore_fields.dart';

/// Droits coach configurables sur `clubs/{clubId}.coachPermissions`.
class CoachPermissions {
  const CoachPermissions({
    this.canCreateEvents = true,
    this.canManageTeamRoster = true,
    this.canInvitePlayers = true,
    this.canTakeAttendance = true,
    this.canViewFees = false,
  });

  final bool canCreateEvents;
  final bool canManageTeamRoster;
  final bool canInvitePlayers;
  final bool canTakeAttendance;
  final bool canViewFees;

  /// Defaults si le map est absent (clubs existants).
  static const CoachPermissions defaults = CoachPermissions();

  /// Parse le map Firestore avec defaults.
  factory CoachPermissions.fromMap(Map<String, dynamic>? map) {
    if (map == null) return defaults;
    return CoachPermissions(
      canCreateEvents: map[FirestoreFields.canCreateEvents] as bool? ?? true,
      canManageTeamRoster:
          map[FirestoreFields.canManageTeamRoster] as bool? ?? true,
      canInvitePlayers: map[FirestoreFields.canInvitePlayers] as bool? ?? true,
      canTakeAttendance: map[FirestoreFields.canTakeAttendance] as bool? ?? true,
      canViewFees: map[FirestoreFields.canViewFees] as bool? ?? false,
    );
  }

  /// True si le viewer coach peut créer des événements.
  bool allowsCreateEvents({required bool isAdmin, required bool isCoach}) {
    if (isAdmin) return true;
    return isCoach && canCreateEvents;
  }

  /// True si le viewer coach peut gérer le roster de ses équipes.
  bool allowsManageTeamRoster({required bool isAdmin, required bool isCoach}) {
    if (isAdmin) return true;
    return isCoach && canManageTeamRoster;
  }

  /// True si le viewer coach peut inviter / ajouter des joueurs.
  bool allowsInvitePlayers({required bool isAdmin, required bool isCoach}) {
    if (isAdmin) return true;
    return isCoach && canInvitePlayers;
  }

  /// True si le viewer coach peut prendre les présences.
  bool allowsTakeAttendance({required bool isAdmin, required bool isCoach}) {
    if (isAdmin) return true;
    return isCoach && canTakeAttendance;
  }

  /// True si le viewer coach peut voir les cotisations (lecture).
  bool allowsViewFees({required bool isAdmin, required bool isCoach}) {
    if (isAdmin) return true;
    return isCoach && canViewFees;
  }

  /// Payload Firestore pour `clubs/{clubId}.coachPermissions`.
  Map<String, bool> toMap() => {
        FirestoreFields.canCreateEvents: canCreateEvents,
        FirestoreFields.canManageTeamRoster: canManageTeamRoster,
        FirestoreFields.canInvitePlayers: canInvitePlayers,
        FirestoreFields.canTakeAttendance: canTakeAttendance,
        FirestoreFields.canViewFees: canViewFees,
      };

  CoachPermissions copyWith({
    bool? canCreateEvents,
    bool? canManageTeamRoster,
    bool? canInvitePlayers,
    bool? canTakeAttendance,
    bool? canViewFees,
  }) {
    return CoachPermissions(
      canCreateEvents: canCreateEvents ?? this.canCreateEvents,
      canManageTeamRoster:
          canManageTeamRoster ?? this.canManageTeamRoster,
      canInvitePlayers: canInvitePlayers ?? this.canInvitePlayers,
      canTakeAttendance: canTakeAttendance ?? this.canTakeAttendance,
      canViewFees: canViewFees ?? this.canViewFees,
    );
  }
}
