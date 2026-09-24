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
  String get mute => 'Couper les notifs';
  String get unmute => 'Réactiver les notifs';
  String get addFavorite => 'Ajouter aux favoris';
  String get removeFavorite => 'Retirer des favoris';
  String get searchConversationsHint => 'Rechercher une discussion…';
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
  String get openTeamChat => 'Ouvrir le chat d’équipe';
  String get openParentsChat => 'Ouvrir le chat parents';
  String get chatEntry => 'Discussions';
  String get photoPreview => 'Photo';
  String get reactions => 'Réagir';
  String get moreEmojis => 'Plus d’émojis';
  String get reactionReactors => 'Qui a réagi';
  String get reactionRemoveMine => 'Clique pour supprimer';
  String get reactionAddMine => 'Réagir aussi';
  String reactionCountLabel(int count) =>
      count <= 1 ? '$count réaction' : '$count réactions';
  String get createCategoryChannel => 'Canal catégorie';
  String get categoryChannelHint => 'Canal en lecture seule (admins écrivent).';
  String get categoryKeyLabel => 'Catégorie (ex. U15)';
  String get createChannel => 'Créer le canal';
  String get channelCreated => 'Canal créé.';
  String get you => 'Vous';
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
}
