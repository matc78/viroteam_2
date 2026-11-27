/**
 * Textes du lien FFVB d’une équipe (panneau Équipes du bureau). Mêmes
 * messages que `AppCopy.standings` côté app.
 */
export const federationCopy = {
  sectionTitle: "Calendrier FFVB",
  loading: "Chargement du lien FFVB…",
  loadFailed: "Impossible de lire le lien FFVB de cette équipe.",
  notLinked: "Pas liée à une poule FFVB.",
  linkAction: "Lier le calendrier FFVB",
  linkActionHint: "Matchs et classement importés tout seuls.",
  editLink: "Modifier",
  // ——— Dialog de liaison ———
  dialogEyebrow: "Calendrier FFVB",
  sheetTitle: "Calendrier et classement FFVB",
  sheetHelper:
    "Colle le lien de la page calendrier de ta poule sur le site FFVB (ffvbbeach.org). On importe les matchs dans le planning et on suit le classement tout seuls.",
  exampleCaption:
    "C’est cette page-là : le calendrier de ta poule. Clique pour agrandir.",
  exampleImageLabel: "Exemple de page calendrier de poule FFVB",
  exampleClose: "Fermer l’exemple",
  urlLabel: "Lien de la poule",
  urlHint: "https://www.ffvbbeach.org/ffvbapp/resu/…",
  checkLink: "Vérifier le lien",
  checkingLink: "Vérification…",
  invalidLink:
    "Ce lien ne ressemble pas à une page de poule FFVB (vbspo_calendrier.php).",
  linkCheckUnavailable:
    "Impossible de vérifier le lien pour l’instant, réessaie dans un moment.",
  pickTeam: "C’est laquelle, ton équipe ?",
  continueAction: "Continuer",
  back: "Retour",
  close: "Fermer",
  convocationStepTitle: "Qui est convoqué ?",
  convocationStepHelper:
    "Tout le monde est convoqué par défaut sur les matchs importés, et sur ceux que la FFVB ajoutera en cours de saison. Décoche ceux qui ne jouent pas ce championnat.",
  convocationStepLater:
    "Tu pourras ajuster match par match plus tard depuis le planning.",
  convocationLegend: "Convoqués par défaut",
  teamNoPlayers: "Aucun joueur dans cette équipe pour l’instant.",
  keepOnePlayerConvoked: "Garde au moins un joueur convoqué.",
  importAction: "Importer les matchs",
  importing: "Import en cours…",
  imported: (count: number) =>
    count <= 1
      ? `Calendrier lié, ${count} match importé.`
      : `Calendrier lié, ${count} matchs importés.`,
  teamInPool: (teamName: string) => `Équipe dans la poule : ${teamName}`,
  lastSync: (date: Date) =>
    `Synchro le ${date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
    })} à ${date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`,
  syncFailed: "Dernière synchro ratée : on garde les données d’avant.",
  openOnFfvb: "Voir sur le site FFVB",
  refresh: "Actualiser",
  refreshing: "Synchro FFVB en cours…",
  refreshed: (changes: number) =>
    changes === 0
      ? "Déjà à jour."
      : `À jour : ${changes} match${changes > 1 ? "s" : ""} mis à jour.`,
  unlink: "Délier",
  unlinkTitle: "Délier le calendrier FFVB ?",
  unlinkBody:
    "Le classement disparaît et les matchs ne sont plus mis à jour.",
  deleteImportedMatches: "Supprimer aussi les matchs importés",
  deleteImportedMatchesHint:
    "Si le lien était le mauvais. Les matchs ajoutés à la main restent.",
  confirmUnlink: "Délier",
  cancel: "Annuler",
  unlinked: "Calendrier FFVB délié.",
  unlinkedWithMatches: (count: number) =>
    count <= 1
      ? `Calendrier FFVB délié, ${count} match supprimé.`
      : `Calendrier FFVB délié, ${count} matchs supprimés.`,
  actionFailed: "Action impossible, réessaie.",
} as const;
