/**
 * Catalogue FR — droits club (attribution par un admin, libellés, refus).
 * Mêmes libellés que l’app (`lib/copy/app_copy_permissions.dart`).
 */
import type { ClubFunction, ClubPermission } from "@/lib/auth/permissions";

/** Libellés des droits. */
const permissionLabels: Record<ClubPermission, string> = {
  admin: "Administrateur",
  manageMembers: "Gérer les membres",
  manageTeams: "Gérer les équipes",
  manageEvents: "Gérer le planning",
  manageAnnouncements: "Gérer les annonces",
  manageFees: "Gérer les cotisations",
  viewFees: "Voir les cotisations",
  manageClubSettings: "Gérer les infos du club",
  manageEquipment: "Gérer le matériel",
  manageChat: "Gérer la messagerie",
  viewActivity: "Voir le journal d’activité",
};

/** Descriptions des droits. */
const permissionDescriptions: Record<ClubPermission, string> = {
  admin: "Tous les droits, y compris attribuer des droits.",
  manageMembers:
    "Ajouter, inviter, modifier et retirer des membres, liens parents.",
  manageTeams:
    "Créer et supprimer des équipes, nommer les coachs, gérer les effectifs.",
  manageEvents:
    "Événements, convocations, appel et réponses de toutes les équipes.",
  manageAnnouncements:
    "Publier, modifier et supprimer les annonces de tout le club.",
  manageFees:
    "Saisons, encaissements, aides et exonérations (inclut la lecture).",
  viewFees: "Suivre les cotisations, sans rien modifier.",
  manageClubSettings: "Identité, apparence, lieux et saison.",
  manageEquipment: "Inventaire du matériel.",
  manageChat: "Créer des canaux et écrire dans les canaux réservés.",
  viewActivity: "Consulter le journal d’activité du club.",
};

/** Libellés des raccourcis (fonctions prédéfinies). */
const functionLabels: Record<ClubFunction, string> = {
  feesManager: "Responsable cotisations",
  announcementsManager: "Responsable annonces",
  membersManager: "Responsable membres",
  sportsManager: "Responsable sportif",
  equipmentManager: "Responsable matériel",
};

/** Descriptions des raccourcis. */
const functionDescriptions: Record<ClubFunction, string> = {
  feesManager: "Saisons, encaissements, aides et suivi des cotisations.",
  announcementsManager: "Annonces à l’échelle de tout le club.",
  membersManager: "Membres, invitations, parents et équipes.",
  sportsManager: "Planning de toutes les équipes et gestion des effectifs.",
  equipmentManager: "Inventaire du matériel du club.",
};

/** Textes de l’attribution des droits. */
export const permissionsCopy = {
  sectionTitle: "Droits",
  intro:
    "Deux niveaux : les capacités sur ses équipes (si entraîneur), puis les droits à l’échelle du club.",
  teamCapabilitiesLegend: "Capacités d’équipe",
  teamCapabilitiesHint:
    "Valables seulement sur les équipes qu’il entraîne. Les mêmes pour tous les coachs — ça se règle dans Paramètres du club.",
  teamCapabilitiesEmpty:
    "Pas encore coach d’une équipe — nomme-le coach dans l’équipe pour lui donner ces capacités.",
  coachedTeamsLabel: (teams: string) => `Équipes : ${teams}`,
  clubRightsLegend: "Droits club",
  functionsLegend: "Raccourcis",
  functionsHint:
    "Un raccourci coche plusieurs droits club d’un coup (Responsable…). S’ils sont déjà attribués, le raccourci apparaît coché.",
  detailLegend: "Détail des droits",
  detailHint:
    "Chaque droit individuellement. Les cases suivent aussi les raccourcis cochés plus haut.",
  adminWarning:
    "L’administrateur a tous les droits, y compris celui d’attribuer des droits aux autres membres. Le club garde toujours au moins un administrateur.",
  partial: "En partie",
  save: "Enregistrer les droits",
  saving: "Enregistrement…",
  ownRightsReadonly:
    "Seul un autre administrateur peut modifier tes droits.",
  cannotChangeOwnRights:
    "Tu ne peux pas modifier tes propres droits — un autre admin doit le faire.",
  lastAdmin:
    "Le club doit garder au moins un administrateur : donne d’abord ce droit à un autre membre.",
  /** Mention d’un droit coché d’office par un autre droit coché. */
  impliedBy: (permission: ClubPermission) =>
    `Inclus avec « ${permissionLabels[permission]} ».`,
  noRights: "Aucun droit particulier",
  noClubRights: "aucun droit club",
  allRights: "Tous les droits",
  rightsCount: (count: number) =>
    count <= 1 ? `${count} droit` : `${count} droits`,
  clubRightsCount: (count: number) =>
    count <= 1 ? `${count} droit club` : `${count} droits club`,
  /** Résumé fiche (« Entraîneur · 1 droit club », …). */
  rightsSummary: (params: {
    isAdmin: boolean;
    permissionCount: number;
    isTeamCoach: boolean;
  }) => {
    if (params.isAdmin) return permissionsCopy.allRights;
    if (params.isTeamCoach) {
      const club =
        params.permissionCount === 0
          ? permissionsCopy.noClubRights
          : permissionsCopy.clubRightsCount(params.permissionCount);
      return `Entraîneur · ${club}`;
    }
    if (params.permissionCount === 0) return permissionsCopy.noRights;
    return permissionsCopy.rightsCount(params.permissionCount);
  },
  updateFailed: "Impossible de mettre à jour les droits.",
  permissionLabel: (permission: ClubPermission) => permissionLabels[permission],
  permissionDescription: (permission: ClubPermission) =>
    permissionDescriptions[permission],
  functionLabel: (clubFunction: ClubFunction) => functionLabels[clubFunction],
  functionDescription: (clubFunction: ClubFunction) =>
    functionDescriptions[clubFunction],
} as const;
