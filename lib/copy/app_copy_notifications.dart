part of 'app_copy.dart';

/// Notifications push : canaux Android, demande de permission, état système.
final class AppCopyNotifications {
  const AppCopyNotifications();

  // Canaux Android (visibles dans Réglages > Notifications de l'app).
  String get channelEventsName => 'Événements';
  String get channelEventsDescription =>
      'Convocations, rappels, changements d’horaire et annulations';
  String get channelAnnouncementsName => 'Annonces';
  String get channelAnnouncementsDescription =>
      'Annonces publiées par ton club';
  String get channelChatName => 'Messages';
  String get channelChatDescription => 'Nouveaux messages des discussions';
  String get channelFeesName => 'Cotisations';
  String get channelFeesDescription => 'Rappels de cotisation';
  String get channelRsvpName => 'Réponses de présence';
  String get channelRsvpDescription =>
      'Quand un membre répond Présent ou Absent';

  // Pré-demande de permission (avant la popup système).
  String get softAskTitle => 'Ne rate plus une convocation';
  String get softAskBody =>
      'Active les notifs et on te prévient au bon moment. '
      'Tu choisis ensuite ce que tu reçois dans les paramètres.';
  String get softAskBenefitEvents => 'Convocations et rappels avant les matchs';
  String get softAskBenefitChanges => 'Changements d’horaire et annulations';
  String get softAskBenefitAnnouncements => 'Annonces du club';
  String get softAskEnable => 'Activer les notifs';
  String get softAskLater => 'Plus tard';
  String get softAskEnabledToast => 'C’est réglé, on te tient au courant !';

  // État système refusé (paramètres).
  String get systemDisabledTitle => 'Les notifs sont coupées sur ton téléphone';
  String get systemDisabledBody =>
      'Autorise ViroTeam à t’envoyer des notifs pour recevoir convocations '
      'et annonces. Les réglages ci-dessous s’appliqueront ensuite.';
  String get systemDisabledAction => 'Autoriser les notifs';
}
