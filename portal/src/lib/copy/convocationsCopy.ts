/**
 * Catalogue FR — gestion des convoqués d’un événement (bureau coach / admin).
 * Création de match (joueurs cochés par défaut) et dialog « Gérer les convoqués ».
 */

/** Textes de la gestion des convoqués. */
export const convocationsCopy = {
  manageAction: "Gérer les convoqués",
  dialogEyebrow: "Convocations",
  dialogTitle: "Gérer les convoqués",
  close: "Fermer",
  listLegend: "Joueurs convoqués",
  listHint:
    "Décochez les joueurs qui ne participent pas : ils ne verront plus l’événement et ne recevront aucune notification.",
  emptyRoster: "Aucun joueur dans les équipes de cet événement.",
  checkAll: "Tout cocher",
  uncheckAll: "Tout décocher",
  countSummary: (checked: number, total: number) =>
    `${checked} convoqué${checked > 1 ? "s" : ""} sur ${total}`,
  scopeLegend: "Appliquer à",
  scopeOccurrence: "Cette séance",
  scopeFollowing: "Celle-ci et les suivantes",
  scopeHint: "Les séances passées ne sont jamais modifiées.",
  cancel: "Annuler",
  save: "Enregistrer",
  saving: "Enregistrement…",
  noChanges: "Aucun changement à enregistrer.",
  saved: (updatedCount: number) =>
    updatedCount > 1
      ? `Convocations mises à jour (${updatedCount} séances)`
      : "Convocations mises à jour",
  saveFailed: "Impossible de mettre à jour les convocations.",
  /** Création de match : liste des joueurs de l’équipe. */
  createLegend: "Joueurs convoqués",
  createHint: "Tous les joueurs de l’équipe sont convoqués : décochez ceux qui ne jouent pas.",
  createEmptyRoster: "Aucun joueur dans cette équipe pour l’instant.",
  createNoneChecked: "Cochez au moins un joueur.",
  memberFallback: "Membre",
} as const;
