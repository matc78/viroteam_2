import {
  COACH_FLAG_DEFAULTS,
  type CoachFlag,
} from "@/lib/auth/permissions";

/**
 * Capacités des coachs d'équipe, réglées pour tout le club sur
 * `clubs/{clubId}.coachPermissions`. Elles ne valent que pour les équipes
 * qu'un coach entraîne (voir `ClubAccess`). Flags et défauts : catalogue
 * partagé (`shared/permissions_catalog.json`).
 */
export type CoachPermissions = Record<CoachFlag, boolean>;

/** Valeurs par défaut si la map est absente (clubs existants). */
export const DEFAULT_COACH_PERMISSIONS: CoachPermissions = {
  ...COACH_FLAG_DEFAULTS,
};

const COACH_FLAGS = Object.keys(COACH_FLAG_DEFAULTS) as CoachFlag[];

/** Parse `clubs/{id}.coachPermissions` ; clé absente ou invalide → défaut. */
export function parseCoachPermissions(raw: unknown): CoachPermissions {
  const map =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const parsed = { ...DEFAULT_COACH_PERMISSIONS };
  for (const flag of COACH_FLAGS) {
    const value = map[flag];
    if (typeof value === "boolean") parsed[flag] = value;
  }
  return parsed;
}

/** Payload Firestore pour `coachPermissions` (tous les flags du catalogue). */
export function coachPermissionsToFirestore(
  permissions: CoachPermissions,
): Record<string, boolean> {
  return Object.fromEntries(COACH_FLAGS.map((flag) => [flag, permissions[flag]]));
}

/** Libellés FR des réglages coach (ordre du catalogue, aligné app). */
export const COACH_PERMISSION_LABELS: {
  key: CoachFlag;
  label: string;
  description: string;
}[] = [
  {
    key: "canCreateEvents",
    label: "Créer des événements",
    description: "Créer et gérer le planning.",
  },
  {
    key: "canManageTeamRoster",
    label: "Gérer le roster",
    description: "Ajouter des joueurs.",
  },
  {
    key: "canInvitePlayers",
    label: "Inviter des joueurs",
    description: "Créer une fiche membre et envoyer une invitation.",
  },
  {
    key: "canTakeAttendance",
    label: "Prendre les présences",
    description:
      "Pointer après la séance pour les stats (optionnel — le RSVP reste prioritaire).",
  },
  {
    key: "canPublishTeamAnnouncements",
    label: "Publier des annonces",
    description: "Envoyer des annonces (pas au club entier).",
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
