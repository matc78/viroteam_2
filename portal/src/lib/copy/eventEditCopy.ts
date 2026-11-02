/**
 * Catalogue FR — modification des infos d'un événement (bureau coach / admin).
 */

/** Textes du dialog « Modifier l'événement ». */
export const eventEditCopy = {
  editAction: "Modifier",
  dialogEyebrow: "Planning",
  dialogTitle: "Modifier l’événement",
  close: "Fermer",
  /** Retour au détail événement (fermeture du dialog). */
  back: "Retour",
  loading: "Chargement…",
  loadFailed: "Impossible de charger l’événement.",
  title: "Titre",
  date: "Date",
  start: "Début",
  end: "Fin",
  matchTime: "Heure du match",
  meetingTime: "Heure de RDV",
  location: "Lieu",
  locationOther: "Autre",
  locationSpecify: "Préciser le lieu",
  locationPlaceholder: "Stade, gymnase…",
  locationChoose: "Choisir un lieu…",
  meetingLocation: "Lieu du RDV (facultatif)",
  notifyHint:
    "Les convoqués sont prévenus par notification si la date, l’heure ou le lieu changent.",
  seriesHint:
    "Seule cette séance est modifiée, pas le reste de la série.",
  cancel: "Annuler",
  save: "Enregistrer",
  saving: "Enregistrement…",
  noChanges: "Aucun changement à enregistrer.",
  saved: "Événement mis à jour",
  saveFailed: "Impossible de mettre à jour l’événement.",
} as const;
