import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';

/// Libellé FR d’un flag coach (aligné portail).
class CoachPermissionLabel {
  const CoachPermissionLabel({
    required this.label,
    required this.description,
    required this.apply,
  });

  final String label;
  final String description;
  final CoachPermissions Function(CoachPermissions current, bool enabled) apply;
}

/// Liste des droits coach éditables (ordre portail).
final coachPermissionLabels = <CoachPermissionLabel>[
  CoachPermissionLabel(
    label: 'Créer des événements',
    description: 'Le coach peut créer et gérer le planning de ses équipes.',
    apply: _applyCanCreateEvents,
  ),
  CoachPermissionLabel(
    label: 'Gérer le roster',
    description: 'Ajouter des joueurs aux équipes qu’il entraîne.',
    apply: _applyCanManageTeamRoster,
  ),
  CoachPermissionLabel(
    label: 'Inviter des joueurs',
    description: 'Créer une fiche membre et envoyer une invitation.',
    apply: _applyCanInvitePlayers,
  ),
  CoachPermissionLabel(
    label: 'Prendre les présences',
    description: 'Réserver pour une future UI présences (flag stocké).',
    apply: _applyCanTakeAttendance,
  ),
  CoachPermissionLabel(
    label: 'Voir les cotisations',
    description: 'Accès lecture au suivi des cotisations du club.',
    apply: _applyCanViewFees,
  ),
];

CoachPermissions _applyCanCreateEvents(CoachPermissions current, bool v) =>
    current.copyWith(canCreateEvents: v);

CoachPermissions _applyCanManageTeamRoster(CoachPermissions current, bool v) =>
    current.copyWith(canManageTeamRoster: v);

CoachPermissions _applyCanInvitePlayers(CoachPermissions current, bool v) =>
    current.copyWith(canInvitePlayers: v);

CoachPermissions _applyCanTakeAttendance(CoachPermissions current, bool v) =>
    current.copyWith(canTakeAttendance: v);

CoachPermissions _applyCanViewFees(CoachPermissions current, bool v) =>
    current.copyWith(canViewFees: v);
