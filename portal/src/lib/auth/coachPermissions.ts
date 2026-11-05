import { Fields } from "@/lib/firebase/constants";

/** Droits coach configurables sur le doc club. */
export type CoachPermissions = {
  canCreateEvents: boolean;
  canManageTeamRoster: boolean;
  canInvitePlayers: boolean;
  canTakeAttendance: boolean;
  canViewFees: boolean;
  canEditMemberLicenses: boolean;
  canEditMemberRsvp: boolean;
};

/** Defaults si le map est absent (clubs existants). */
export const DEFAULT_COACH_PERMISSIONS: CoachPermissions = {
  canCreateEvents: true,
  canManageTeamRoster: true,
  canInvitePlayers: true,
  canTakeAttendance: true,
  canViewFees: false,
  canEditMemberLicenses: false,
  canEditMemberRsvp: false,
};

/** Parse `clubs/{id}.coachPermissions` avec defaults. */
export function parseCoachPermissions(raw: unknown): CoachPermissions {
  const map =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    canCreateEvents:
      map[Fields.canCreateEvents] === undefined
        ? DEFAULT_COACH_PERMISSIONS.canCreateEvents
        : Boolean(map[Fields.canCreateEvents]),
    canManageTeamRoster:
      map[Fields.canManageTeamRoster] === undefined
        ? DEFAULT_COACH_PERMISSIONS.canManageTeamRoster
        : Boolean(map[Fields.canManageTeamRoster]),
    canInvitePlayers:
      map[Fields.canInvitePlayers] === undefined
        ? DEFAULT_COACH_PERMISSIONS.canInvitePlayers
        : Boolean(map[Fields.canInvitePlayers]),
    canTakeAttendance:
      map[Fields.canTakeAttendance] === undefined
        ? DEFAULT_COACH_PERMISSIONS.canTakeAttendance
        : Boolean(map[Fields.canTakeAttendance]),
    canViewFees:
      map[Fields.canViewFees] === undefined
        ? DEFAULT_COACH_PERMISSIONS.canViewFees
        : Boolean(map[Fields.canViewFees]),
    canEditMemberLicenses:
      map[Fields.canEditMemberLicenses] === undefined
        ? DEFAULT_COACH_PERMISSIONS.canEditMemberLicenses
        : Boolean(map[Fields.canEditMemberLicenses]),
    canEditMemberRsvp:
      map[Fields.canEditMemberRsvp] === undefined
        ? DEFAULT_COACH_PERMISSIONS.canEditMemberRsvp
        : Boolean(map[Fields.canEditMemberRsvp]),
  };
}

/** Payload Firestore pour coachPermissions. */
export function coachPermissionsToFirestore(
  permissions: CoachPermissions,
): Record<string, boolean> {
  return {
    [Fields.canCreateEvents]: permissions.canCreateEvents,
    [Fields.canManageTeamRoster]: permissions.canManageTeamRoster,
    [Fields.canInvitePlayers]: permissions.canInvitePlayers,
    [Fields.canTakeAttendance]: permissions.canTakeAttendance,
    [Fields.canViewFees]: permissions.canViewFees,
    [Fields.canEditMemberLicenses]: permissions.canEditMemberLicenses,
    [Fields.canEditMemberRsvp]: permissions.canEditMemberRsvp,
  };
}

/** True si admin, ou coach avec le flag `canEditMemberRsvp`. */
export function allowsEditMemberRsvp(params: {
  isAdmin: boolean;
  isCoach: boolean;
  permissions: CoachPermissions;
}): boolean {
  if (params.isAdmin) return true;
  return params.isCoach && params.permissions.canEditMemberRsvp;
}

/** Libellés FR des toggles paramètres. */
export const COACH_PERMISSION_LABELS: {
  key: keyof CoachPermissions;
  label: string;
  description: string;
}[] = [
  {
    key: "canCreateEvents",
    label: "Créer des événements",
    description: "Le coach peut créer et gérer le planning de ses équipes.",
  },
  {
    key: "canManageTeamRoster",
    label: "Gérer le roster",
    description: "Ajouter des joueurs aux équipes qu’il entraîne.",
  },
  {
    key: "canInvitePlayers",
    label: "Inviter des joueurs",
    description: "Créer une fiche membre et envoyer une invitation.",
  },
  {
    key: "canTakeAttendance",
    label: "Prendre les présences",
    description: "Réserver pour une future UI présences (flag stocké).",
  },
  {
    key: "canViewFees",
    label: "Voir les cotisations",
    description: "Accès lecture au suivi des cotisations du club.",
  },
  {
    key: "canEditMemberLicenses",
    label: "Modifier les licences",
    description: "Éditer le numéro de licence des joueurs.",
  },
  {
    key: "canEditMemberRsvp",
    label: "Modifier les réponses RSVP",
    description:
      "Changer la réponse (oui / non / peut-être) d’un joueur ou coach convoqué.",
  },
];
