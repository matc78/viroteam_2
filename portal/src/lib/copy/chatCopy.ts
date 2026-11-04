/**
 * Catalogue FR — messagerie portail.
 *
 * Clés alignées sur `lib/copy/app_copy_chat.dart` quand le sens est le même ;
 * les textes restent ceux du portail (registre propre, pas de recopie de l'app).
 */

/** Accord simple « 1 x » / « n xs » (0 et 1 au singulier). */
function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

export const chatCopy = {
  // --- Commun ---
  close: "Fermer",
  back: "Retour",
  cancel: "Annuler",
  save: "Enregistrer",
  loading: "Chargement…",
  /** Nom affiché d'un membre introuvable. */
  unknownMember: "Membre",
  /** Nom affiché d'un parent hors annuaire club. */
  unknownParent: "Parent",
  /** Auteur inconnu d'un message. */
  someone: "Quelqu’un",
  /** Le viewer dans la liste des réactions. */
  you: "Toi",
  /** Le viewer comme auteur d'une citation (réponse). */
  replyAuthorSelf: "Toi",
  /** Libellé accessible de l'étoile favori. */
  favoriteMark: "Favori",
  /** Alt d'une photo de groupe / de profil agrandie. */
  photoOfAlt: (name: string) => `Photo de ${name}`,
  /** `n membre(s)` (fiche et intro de groupe). */
  memberCount: (count: number) => plural(count, "membre"),

  // --- Entrée messagerie, dock, page ---
  chatEntry: "Messagerie",
  chatEntryWithUnread: (count: number) =>
    count <= 0
      ? "Messagerie"
      : `Messagerie, ${count} non lu${count > 1 ? "s" : ""}`,
  pageLead:
    "Toutes tes discussions, tous clubs confondus — équipes, parents, coaches.",
  openMessaging: "Ouvrir la messagerie",
  openMessagingPage: "Ouvrir la messagerie en page",
  collapseDock: "Réduire",
  /** Libellé accessible de la fenêtre flottante. */
  floatingThreadLabel: "Conversation",
  newConversation: "Nouvelle discussion",
  createCategoryChannel: "Créer canal",
  /** Placeholder : `filterInbox` cherche dans le titre, le club et le dernier message. */
  searchConversationsHint: "Nom, club ou dernier message…",
  searchConversationsLabel: "Rechercher une discussion",
  searchNoResults: "Aucune discussion ne correspond à ta recherche.",
  emptyInbox: "Aucune discussion pour l’instant.",
  emptyInboxHint:
    "Les chats d’équipe et parents apparaissent dès que ton club est prêt.",
  loadError: "Impossible de charger les discussions.",
  retry: "Réessayer",
  selectConversationHint: "Sélectionne une discussion pour commencer.",

  // --- Tuile d'inbox ---
  emptyPreview: "Aucun message",
  unreadPreview: (count: number) =>
    count <= 1 ? `${count} nouveau message` : `${count} nouveaux messages`,
  mutedNotifications: "Notifications coupées",

  // --- Nouvelle discussion ---
  newConversationHint: "Tu peux écrire à tes coaches ou à un admin du club.",
  clubLabel: "Club",
  pickTargets: "Choisir qui contacter",
  noTargets: "Aucun coach ou admin disponible.",
  startChat: "Démarrer",
  startingChat: "Ouverture…",
  targetsLoadFailed: "Impossible de charger les contacts.",
  startChatFailed: "Impossible de démarrer la discussion.",

  // --- Créer un canal ---
  categoryChannelHint:
    "Canal en lecture seule (seuls les admins écrivent). Le canal « tout le club » existe déjà.",
  channelAudienceLabel: "Destinataires",
  channelTitleHint: "Titre affiché",
  channelTitlePlaceholder: "Ex. Parents U15",
  createChannel: "Créer le canal",
  creatingChannel: "Création…",
  channelCreateFailed: "Création du canal impossible.",
  teamsLoading: "Chargement des équipes…",
  teamsLoadFailed: "Impossible de charger les équipes.",
  scopeCategories: "Catégories",
  scopeTeams: "Équipes",
  scopeParents: "Parents d’équipes",
  scopeTypeLabel: "Type de cible",
  scopeTargetsLabel: "Cibles",
  channelOptionsCategoriesHint: "Catégories des équipes du club",
  channelOptionsTeamsHint: "Équipes du club",
  channelOptionsParentsHint: "Équipes avec joueurs",
  noCategoriesForChannel: "Aucune catégorie sur les équipes du club.",
  noTeamsForChannel: "Aucune équipe dans ce club.",
  noTeamsWithPlayersForChannel: "Aucune équipe avec joueurs.",
  parentsOfTeamLabel: (teamName: string) => `Parents · ${teamName}`,

  // --- Fil ---
  /** Titre tant que la conversation n'est pas chargée. */
  conversationFallbackTitle: "Discussion",
  messagesLogLabel: "Messages",
  loadOlderMessages: "Charger plus",
  loadOlderFailed: "Impossible de charger l’historique.",
  emptyThread: "Aucun message pour l’instant.",
  emptyThreadHint: "Envoie le premier message pour lancer la discussion.",
  threadLoadFailed: "Impossible de charger la discussion.",
  unreadSeparatorLabel: "nouveau",
  /** Bouton flottant quand on a remonté dans l’historique. */
  jumpToLatest: "Derniers messages",
  newMessagesBelow: (count: number) =>
    count <= 1 ? "1 nouveau message" : `${count} nouveaux messages`,
  /** Annonce lecteur d’écran d’un message reçu pendant la lecture du fil. */
  newMessageAnnouncement: (author: string, preview: string) =>
    `Nouveau message de ${author} : ${preview}`,
  /** Bouton retour du fil en plein écran (portail mobile). */
  backToInbox: "Retour aux discussions",
  today: "Aujourd'hui",
  yesterday: "Hier",

  // --- En-tête du fil ---
  conversationInfo: "Infos de la discussion",
  threadOptions: "Options",
  searchMessage: "Rechercher un message",
  mute: "Couper les notifs",
  unmute: "Réactiver les notifs",
  addFavorite: "Ajouter aux favoris",
  removeFavorite: "Retirer des favoris",
  renameConversation: "Renommer",
  changeGroupAvatar: "Changer la photo",
  groupAvatarUploadFailed: "Impossible de changer la photo.",
  createPoll: "Faire un sondage",
  maximize: "Agrandir",
  muteFailed: "Impossible de couper les notifs.",
  unmuteFailed: "Impossible de réactiver les notifs.",
  favoriteFailed: "Impossible de modifier les favoris.",

  // --- Recherche dans le fil ---
  searchMessagesHint: "Rechercher dans la discussion",
  searchNoMatch: "Aucun résultat",
  /** Compteur affiché : position (1 = plus récent) / total. */
  searchCounter: (position: number, total: number) => `${position} / ${total}`,
  searchCounterLabel: (position: number, total: number) =>
    `Résultat ${position} sur ${total}`,
  searchOlder: "Résultat suivant (plus ancien)",
  searchNewer: "Résultat précédent (plus récent)",

  // --- Composer ---
  replyTo: "Réponse à",
  cancelReply: "Annuler la réponse",
  attachAdd: "Ajouter",
  attachPhotos: "Photos",
  messageHint: "Écrire un message…",
  send: "Envoyer",
  photoFailed: "Envoi de la photo impossible.",
  sendFailed: "Envoi impossible.",
  unknownError: "erreur inconnue",
  /** Bandeau du composer pendant la modification d’un message. */
  editingBanner: "Modification",
  cancelEdit: "Annuler la modification",
  /** Statut d’envoi optimiste sur la bulle. */
  messageSending: "Envoi…",
  messageSendFailed: "Échec",
  retrySend: "Réessayer",
  retrySendLabel: "Échec de l’envoi, clique pour réessayer",

  // --- Bulle et actions ---
  messageDeleted: "Message supprimé",
  enlargePhoto: "Agrandir la photo",
  photoPreview: "Photo",
  photoFullscreen: "Photo en plein écran",
  photoUnavailable: "Photo indisponible",
  messageActions: "Actions du message",
  reply: "Répondre",
  copyMessage: "Copier",
  editMessage: "Modifier",
  deleteMessage: "Supprimer",
  deleteMessageConfirm: "Supprimer ce message ?",
  deleteMessageFailed: "Suppression impossible.",
  copyFailed: "Copie impossible.",
  editFailed: "Modification impossible.",
  reactionFailed: "Réaction impossible.",

  // --- Réactions ---
  reactions: "Réagir",
  moreEmojis: "Plus d’émojis",
  addReaction: "Ajouter une réaction",
  reactionRemoveMine: "Clique pour supprimer",
  reactionCountLabel: (count: number) => plural(count, "réaction"),
  emojiLoading: "Chargement des émojis…",
  emojiSearchHint: "Rechercher un emoji",

  // --- Sondages ---
  pollLabel: "Sondage",
  createPollLabel: "Créer un sondage",
  pollQuestionLabel: "Question",
  pollQuestionHint: "Ex. Qui amène les ballons ?",
  pollOptionLabel: (index: number) => `Option ${index}`,
  pollAddOption: "Ajouter une option",
  pollSingleChoice: "Réponse unique",
  pollAllowMultiple: "Plusieurs réponses possibles",
  pollSend: "Envoyer le sondage",
  pollSending: "Envoi…",
  pollFailed: "Impossible de créer le sondage.",
  pollVoteFailed: "Vote impossible.",
  pollNeedOptions: "Ajoute au moins 2 options.",
  pollVotersLabel: (count: number) => plural(count, "vote"),
  pollOptionVotesLabel: (count: number) => plural(count, "vote"),
  viewVotes: "Voir les votes",
  pollDetailsTitle: "Détails du sondage",
  pollVotedSummary: (voted: number, total: number) =>
    `Membres ayant voté : ${voted} sur ${total}`,
  pollNoVotesYet: "Personne n’a encore voté.",
  pollOptionNoVotes: "Aucun vote",

  // --- Panneau infos ---
  memberCard: "Fiche membre",
  contactInfo: "Infos du contact",
  groupInfo: "Infos du groupe",
  directInfo: "Infos",
  enlargeGroupPhoto: "Agrandir la photo du groupe",
  changeGroupPhoto: "Changer la photo du groupe",
  /** Préfixe de la ligne « Groupe · n membres ». */
  groupKind: "Groupe",
  /** Type affiché sous le nom d'un DM. */
  directKind: "Discussion",
  searchAction: "Rechercher",
  /** Formes courtes de `mute` / `unmute` (boutons rapides du panneau infos). */
  muteAction: "Couper",
  unmuteAction: "Réactiver",
  favoritesAction: "Favoris",
  conversationMedia: "Médias, liens et documents",
  noConversationMedia: "Aucun média pour l’instant.",
  sharedPhotoAlt: "Photo partagée",
  importantMessages: "Messages importants",
  inFavorites: "Dans les favoris",
  notInFavorites: "Pas encore en favori",
  notificationSettings: "Paramètres de notification",
  allNotifications: "Toutes les notifications",
  membersLoading: "Chargement des membres…",
  noMembersResolved: "Aucun membre résolu.",
  contactSection: "Contact",
  renameDialogTitle: "Renommer la discussion",
  renameInputLabel: "Nouveau nom",
  renameFailed: "Impossible de renommer la discussion.",

  // --- Intro de groupe ---
  roleBreakdown: "Répartition des rôles",
  openGroupInfo: "Ouvrir les infos du groupe",
  roleCountAdmins: (count: number) => plural(count, "admin"),
  roleCountCoaches: (count: number) => plural(count, "coach"),
  roleCountPlayers: (count: number) => plural(count, "joueur"),
  roleCountParents: (count: number) => plural(count, "parent"),

  // --- Canaux en lecture seule ---
  readonlyAdminsOnly: "Seuls les admins peuvent écrire ici.",
  readonlyCoachesAndAdmins:
    "Seuls les coachs et les admins peuvent écrire ici.",
} as const;
