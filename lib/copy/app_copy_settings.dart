part of 'app_copy.dart';

/// Paramètres compte / session / notifs.
final class AppCopySettings {
  const AppCopySettings();

  String get screenTitle => 'Paramètres';
  String get myAccount => 'Mon compte';
  String get myAccountSubtitle =>
      'Avatar, identité et sécurité de ton compte ViroTeam.';
  String get editProfile => 'Modifier le profil';
  String get email => 'E-mail';
  String get password => 'Mot de passe';
  String get connectionType => 'Type de connexion';
  String get myClubs => 'Mes clubs';
  String get legalSection => 'Légal';
  String get termsOfService => 'Conditions générales';
  String get privacy => 'Confidentialité';
  String get legalMentions => 'Mentions légales';
  String get profileNotFound => 'Profil introuvable';
  String get noClubsYet =>
      'Aucun club pour l’instant — crée le tien ou rejoins-en un.';
  String get loadProfileError => 'Impossible de charger le profil';
  String get loadClubsError => 'Impossible de charger les clubs';

  String get appearanceSection => 'Apparence';
  String get appearanceSubtitle =>
      'Plutôt jour ou plutôt nocturne ? Choisis le thème de l’app sur cet appareil.';
  String get themeSystem => 'Comme ton téléphone';
  String get themeSystemSubtitle => 'Suit le réglage clair / sombre du système';
  String get themeLight => 'Clair';
  String get themeDark => 'Sombre';

  String get analyticsSection => 'Mesure d’audience';
  String get analyticsSubtitle =>
      'Aide-nous à savoir ce qui marche dans l’app et ce qui coince.';
  String get analyticsToggle => 'Statistiques d’usage';
  String get analyticsToggleSubtitle =>
      'Écrans visités et fonctions utilisées. Pas de pub, pas de revente.';
  String get analyticsConsentTitle => 'Tu nous files un coup de main ?';
  String get analyticsConsentBody =>
      'On aimerait mesurer comment l’app est utilisée pour savoir quoi '
      'améliorer en priorité.';
  String get analyticsConsentPointUsage =>
      'Les écrans visités et les fonctions utilisées';
  String get analyticsConsentPointNoContent =>
      'Jamais tes messages, ton nom ni ton e-mail';
  String get analyticsConsentPointNoAds => 'Pas de pub, pas de revente';
  String get analyticsConsentFooter =>
      'Tu peux changer d’avis à tout moment dans tes paramètres.';
  String get analyticsConsentAccept => 'Ok, j’accepte';
  String get analyticsConsentDecline => 'Non merci';

  String get notificationsSection => 'Notifications';
  String get notificationsSubtitle =>
      'Choisis quels rappels tu reçois sur cet appareil.';
  String get notifEvents => 'Convocations et rappels';
  String get notifEventsSubtitle =>
      'Nouvelle convocation, rappel 2 jours avant et le jour J, annulations';
  String get notifWeeklyDigest => 'Récap de la semaine';
  String get notifWeeklyDigestSubtitle =>
      'Le dimanche soir : ton programme et les réponses attendues';
  String get notifRsvp => 'Réponses aux convocations';
  String get notifRsvpSubtitle =>
      'Coachs : qui vient, qui ne vient pas. Parents : la réponse posée pour ton enfant';
  String get notifRsvpTeammates => 'Réponses des coéquipiers';
  String get notifRsvpTeammatesSubtitle =>
      'Savoir qui vient aux entraînements et aux matchs';
  String get notifCoachSummary => 'Bilan des réponses';
  String get notifCoachSummarySubtitle =>
      'Coachs : le décompte de qui vient, au moment qui t’arrange';
  String get coachSummaryJ2 => 'J-2';
  String get coachSummaryEve => 'Veille';
  String get coachSummaryDay => 'Jour J';
  String get notifAnnouncements => 'Annonces';
  String get notifAnnouncementsSubtitle => 'À la publication d’une annonce';
  String get notifFees => 'Cotisations';
  String get notifFeesSubtitle => 'Rappel chaque lundi soir';
  String get notifChat => 'Messages';
  String get notifChatSubtitle => 'Nouveaux messages des discussions';
  String get disableNotificationsTitle => 'Désactiver les notifications';
  String get disableAction => 'Désactiver';
  String get notifPrefSaveFailed => 'Impossible d’enregistrer la préférence';
  String get notifOffWarningEvents =>
      'Tu ne recevras plus les convocations, les rappels (2 jours avant, jour J) ni les notifs envoyées par les coachs.';
  String get notifOffWarningWeeklyDigest =>
      'Tu ne recevras plus le récap du dimanche soir. Les rappels 2 jours avant prendront le relais.';
  String get notifOffWarningAnnouncements =>
      'Tu ne recevras plus de notification à la publication des annonces du club.';
  String get notifOffWarningFees =>
      'Tu ne recevras plus les rappels hebdomadaires de cotisation.';
  String get notifOffWarningRsvp =>
      'Tu ne recevras plus de notif quand quelqu’un répond à une convocation.';
  String get notifOffWarningChat =>
      'Tu ne recevras plus de notification pour les nouveaux messages.';
  String get notifOffWarningDefault =>
      'Tu ne recevras plus ce type de notification.';

  String get sessionSection => 'Session';
  String get sessionSubtitle =>
      'Actions sensibles — une confirmation te sera demandée.';
  String get signOut => 'Se déconnecter';
  String get signOutSubtitle => 'Quitter la session sur cet appareil';
  String get signOutDialogBody => 'Tu quittes la session sur cet appareil. '
      'Tu pourras te reconnecter à tout moment avec le même compte.';
  String get signOutFailed => 'Déconnexion impossible';
  String get deleteAccountTitle => 'Supprimer le compte';
  String get deleteAccountAction => 'Supprimer';
  String get deleteMyAccount => 'Supprimer mon compte';
  String get deleteAccountSubtitle => 'Action irréversible';
  String get deleteAccountDialogBody =>
      'Action irréversible. Ton compte Auth sera supprimé. '
      'Les données club ne sont pas purgées automatiquement.';
  String get deleteAccountConfirmCheckbox =>
      'Je confirme vouloir supprimer mon compte';
  String get googleConfirmWindow =>
      'Une fenêtre Google s’ouvrira pour confirmer.';
  String get appleConfirmWindow =>
      'Une fenêtre Apple s’ouvrira pour confirmer.';
  String get currentPassword => 'Mot de passe actuel';
  String get wrongPassword => 'Mot de passe incorrect';
  String get deleteFailed => 'Suppression impossible';
  String get notConnected => 'Aucun utilisateur connecté';
  String get providerEmailPassword => 'Email / mot de passe';
  String get providerGoogle => 'Google';
  String get providerUnknown => 'Inconnu';
  String get accountNoPassword => 'Ce compte n’utilise pas de mot de passe.';
  String get emailMissingForReauth =>
      'E-mail manquant pour la réauthentification.';
  String get currentPasswordRequired => 'Mot de passe actuel requis.';
  String get noReauthMethod => 'Aucun moyen de réauthentification disponible.';
  String get deleteAccountFailed =>
      'Suppression du compte impossible. Réessaie plus tard.';

  String get changeEmailTitle => 'Changer l’e-mail';
  String get newEmail => 'Nouvel e-mail';
  String get googleConfirmEmailChange =>
      'Une fenêtre Google s’ouvrira pour confirmer le changement.';
  String get appleConfirmEmailChange =>
      'Une fenêtre Apple s’ouvrira pour confirmer le changement.';
  String get emailVerificationSent =>
      'E-mail de vérification envoyé. Profil mis à jour.';

  String get changePasswordTitle => 'Changer le mot de passe';
  String get newPassword => 'Nouveau mot de passe';
  String get confirmPassword => 'Confirmer';
  String get passwordsMismatch => 'Les mots de passe ne correspondent pas.';
  String get passwordUpdated => 'Mot de passe mis à jour';

  String get editProfileTitle => 'Modifier le profil';
  String get phoneOptional => 'Téléphone (optionnel)';
  String get nameRequired => 'Indique au moins un prénom ou un nom.';
  String get profileUpdated => 'Profil mis à jour';
  String get saveFailed => 'Enregistrement impossible.';
  String get firstName => 'Prénom';
  String get lastName => 'Nom';

  String get avatarUpdated => 'Avatar mis à jour';
  String get avatarUploadFailed => 'Upload avatar impossible';
}
