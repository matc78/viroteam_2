part of 'app_copy.dart';

/// Textes UI messagerie in-app.
final class AppCopyChat {
  const AppCopyChat();

  String get conversationsTitle => 'Discussions';
  String get emptyInbox => 'Aucune discussion pour l’instant.';
  String get emptyInboxHint =>
      'Les chats d’équipe et parents apparaissent dès que ton club est prêt.';
  /// Preview inbox quand la conversation n’a encore aucun message.
  String get emptyPreview => 'Aucun message';

  /// Remplace la preview quand il y a des messages non lus.
  String unreadPreview(int count) =>
      count <= 1 ? '$count nouveau message' : '$count nouveaux messages';

  /// Libellé du séparateur one-shot à l’ouverture d’un fil avec non-lus.
  String get unreadSeparatorLabel => 'nouveau';
  String get newConversation => 'Nouvelle discussion';
  String get newConversationHint =>
      'Tu peux écrire à tes coaches ou à un admin du club.';
  String get pickTargets => 'Choisir qui contacter';
  String get noTargets => 'Aucun coach ou admin disponible.';
  String get startChat => 'Démarrer';
  String get messageHint => 'Écrire un message…';
  String get sendFailed => 'Envoi impossible.';
  String get photoFailed => 'Envoi de la photo impossible.';
  String get messageDeleted => 'Message supprimé';
  String get deleteMessage => 'Supprimer';
  String get deleteMessageConfirm => 'Supprimer ce message ?';
  String get copyMessage => 'Copier';
  String get editMessage => 'Modifier';
  String get editMessageHint => 'Nouveau texte';
  String get messageEdited => 'modifié';
  String get messageCopied => 'Message copié';
  String get renameConversation => 'Renommer';
  String get renameHint => 'Nouveau nom';
  String get changeGroupAvatar => 'Changer la photo';
  String get changeGroupAvatarCamera => 'Appareil photo';
  String get changeGroupAvatarGallery => 'Galerie';
  String get groupAvatarUpdated => 'Photo du groupe mise à jour.';
  String get groupAvatarUploadFailed => 'Impossible de changer la photo.';
  String get mute => 'Couper les notifs';
  String get unmute => 'Réactiver les notifs';
  String get addFavorite => 'Ajouter aux favoris';
  String get removeFavorite => 'Retirer des favoris';
  /// Placeholder inbox : filtre titre / interlocuteur, club, dernier message
  /// et prénom de son auteur (`filterInboxConversations`).
  String get searchConversationsHint => 'Nom, club ou dernier message…';

  /// Inbox : la recherche ne trouve aucune discussion (≠ inbox vide).
  String get inboxSearchNoResults => 'Rien qui colle à ta recherche.';
  String get inboxSearchNoResultsHint =>
      'Essaie un nom, un club ou un mot du dernier message.';
  String get searchMessagesHint => 'Rechercher dans les messages…';
  String get searchNoResults => 'Aucun résultat.';
  String get conversationInfo => 'Infos de la discussion';
  String get conversationMembers => 'Participants';
  String get loadOlderMessages => 'Charger plus';
  String get loadOlderFailed => 'Impossible de charger l’historique.';
  String get reply => 'Répondre';
  String get replyTo => 'Réponse à';
  String get cancelReply => 'Annuler la réponse';
  String get conversationMedia => 'Médias & liens';
  String get noConversationMedia => 'Pas encore de médias.';
  String get makeAnnouncement => 'Faire une annonce';
  String get readonlyHint => 'Seuls les admins peuvent écrire ici.';
  String get readonlyHintCoachesAndAdmins =>
      'Seuls les coachs et les admins peuvent écrire ici.';
  String get openTeamChat => 'Ouvrir le chat d’équipe';
  String get openParentsChat => 'Ouvrir le chat parents';
  String get chatEntry => 'Discussions';
  String chatEntryWithUnread(int count) =>
      count <= 0 ? chatEntry : '$chatEntry, $count non lus';
  String get sendMessage => 'Envoyer le message';
  String get photoPreview => 'Photo';
  String get reactions => 'Réagir';
  String get moreEmojis => 'Plus d’émojis';
  String get reactionReactors => 'Qui a réagi';
  String get reactionRemoveMine => 'Clique pour supprimer';
  String get reactionAddMine => 'Réagir aussi';
  String reactionCountLabel(int count) =>
      count <= 1 ? '$count réaction' : '$count réactions';

  /// Lecteurs d’écran : bouton emoji du sélecteur de réaction.
  String reactWithEmoji(String emoji) => 'Réagir avec $emoji';

  /// Lecteurs d’écran : action rapide « cœur » sur une bulle.
  String get reactWithHeart => 'Réagir avec un cœur';

  /// Lecteurs d’écran : ouvre la feuille d’actions du message.
  String get messageActions => 'Plus d’actions';

  /// Lecteurs d’écran : chips de réaction sous un message.
  String reactionChipsLabel(List<({String emoji, int count})> reactions) =>
      'Réactions : ${reactions.map((r) => '${r.emoji} ${r.count}').join(', ')}';

  /// Menu « ⋮ » de l’en-tête du fil.
  String get threadMenu => 'Options de la discussion';

  /// Avatar de l’en-tête du fil : ouvre la photo en grand.
  String get viewConversationPhoto => 'Voir la photo de la discussion';
  String get createCategoryChannel => 'Créer canal';
  String get categoryChannelHint =>
      'Canal en lecture seule (admins écrivent). Le canal « tout le club » existe déjà.';
  String get categoryKeyLabel => 'Catégorie (ex. U15)';
  String get createChannel => 'Créer le canal';
  String get channelCreated => 'Canal créé.';
  String get channelAudienceLabel => 'Destinataires';
  String get scopeCategories => 'Catégories';
  String get scopeTeams => 'Équipes';
  String get scopeParents => 'Parents d’équipes';
  String get noCategoriesForChannel =>
      'Aucune catégorie sur les équipes du club.';
  String get noTeamsForChannel => 'Aucune équipe dans ce club.';
  String get noTeamsWithPlayersForChannel =>
      'Aucune équipe avec joueurs.';
  String get channelOptionsCategoriesHint =>
      'Catégories des équipes du club';
  String get channelOptionsTeamsHint => 'Équipes du club';
  String get channelOptionsParentsHint => 'Équipes avec joueurs';
  String parentsOfTeamLabel(String teamName) => 'Parents · $teamName';
  String get channelTitleHint => 'Titre affiché';
  String get you => 'Toi';
  String get loadError => 'Impossible de charger les discussions.';

  String get attachAdd => 'Ajouter';
  String get attachCamera => 'Appareil photo';
  String get attachPhotos => 'Photos';
  String get createPoll => 'Faire un sondage';
  String get pollLabel => 'Sondage';
  String get pollQuestionLabel => 'Question';
  String get pollQuestionHint => 'Ex. Qui amène les ballons ?';
  String get pollOptionLabel => 'Option';
  String get pollAddOption => 'Ajouter une option';
  String get pollRemoveOption => 'Retirer l’option';
  String get pollSingleChoice => 'Réponse unique';
  String get pollAllowMultiple => 'Plusieurs réponses possibles';
  String get pollSend => 'Envoyer le sondage';
  String get pollFailed => 'Impossible de créer le sondage.';
  String get pollVoteFailed => 'Vote impossible.';
  String get pollNeedOptions => 'Ajoute au moins 2 options.';
  String pollVotersLabel(int count) =>
      count <= 1 ? '$count vote' : '$count votes';
  String get viewVotes => 'Voir les votes';
  String get pollDetailsTitle => 'Détails du sondage';
  String pollVotedSummary(int voted, int total) =>
      'Membres ayant voté : $voted sur $total';
  String pollOptionVotesLabel(int count) =>
      count <= 1 ? '$count vote' : '$count votes';
  String get pollNoVotesYet => 'Personne n’a encore voté.';
  String get pollUnavailable => 'Ce sondage n’est plus dispo.';
  String get pollUnknownVoter => 'Membre';

  /// Fil sans aucun message (après chargement).
  String get emptyThread => 'Aucun message pour l’instant.';
  String get emptyThreadHint => 'Envoie le premier message pour lancer la discussion.';

  /// FAB quand on a scrollé dans l’historique.
  String get jumpToLatest => 'Derniers messages';
  String newMessagesBelow(int count) =>
      count <= 1 ? '1 nouveau message' : '$count nouveaux messages';

  /// Statut d’envoi optimiste sur la bulle.
  String get messageSending => 'Envoi…';
  String get messageSendFailed => 'Échec';
  String get retrySend => 'Réessayer';

  /// Fil : chargement impossible (avec « Réessayer »).
  String get threadLoadError => 'Impossible de charger les messages.';

  /// Photo d’une bulle qui ne charge pas / en cours d’envoi (lecteurs d’écran).
  String get imageLoadFailed => 'Photo indisponible';
  String get photoUploading => 'Envoi de la photo';

  /// Bandeau du composer en mode modification.
  String get editingMessage => 'Modification du message';
  String get cancelEdit => 'Annuler la modification';
  String get saveEdit => 'Enregistrer';

  /// Recherche dans le fil : position du résultat courant et navigation.
  String searchResultPosition(int current, int total) => '$current / $total';
  String get searchNoResult => 'Aucun résultat';
  String get searchPrevious => 'Résultat plus ancien';
  String get searchNext => 'Résultat plus récent';
}
