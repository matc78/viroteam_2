part of 'app_copy.dart';

/// Textes UI messagerie in-app.
final class AppCopyChat {
  const AppCopyChat();

  String get conversationsTitle => 'Discussions';
  String get emptyInbox => 'Aucune discussion pour l’instant.';
  String get emptyInboxHint =>
      'Les chats d’équipe et parents apparaissent dès que ton club est prêt.';
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
  String get renameConversation => 'Renommer';
  String get renameHint => 'Nouveau nom';
  String get mute => 'Couper les notifs';
  String get unmute => 'Réactiver les notifs';
  String get makeAnnouncement => 'Faire une annonce';
  String get readonlyHint => 'Seuls les admins peuvent écrire ici.';
  String get openTeamChat => 'Ouvrir le chat d’équipe';
  String get openParentsChat => 'Ouvrir le chat parents';
  String get chatEntry => 'Discussions';
  String get photoPreview => 'Photo';
  String get reactions => 'Réagir';
  String get createCategoryChannel => 'Canal catégorie';
  String get categoryChannelHint => 'Canal en lecture seule (admins écrivent).';
  String get categoryKeyLabel => 'Catégorie (ex. U15)';
  String get createChannel => 'Créer le canal';
  String get channelCreated => 'Canal créé.';
  String get you => 'Toi';
  String get loadError => 'Impossible de charger les discussions.';

  String get createPoll => 'Sondage';
  String get pollQuestionLabel => 'Question';
  String get pollQuestionHint => 'Ex. Qui amène les ballons ?';
  String get pollOptionLabel => 'Option';
  String get pollAddOption => 'Ajouter une option';
  String get pollAllowMultiple => 'Plusieurs réponses possibles';
  String get pollSend => 'Envoyer le sondage';
  String get pollFailed => 'Impossible de créer le sondage.';
  String get pollVoteFailed => 'Vote impossible.';
  String get pollNeedOptions => 'Ajoute au moins 2 options.';
  String pollVotersLabel(int count) =>
      count <= 1 ? '$count vote' : '$count votes';
}
