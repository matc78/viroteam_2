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

  String get notificationsSection => 'Notifications';
  String get notificationsSubtitle =>
      'Choisis quels rappels tu reçois sur cet appareil.';
  String get notifEvents => 'Événements';
  String get notifEventsSubtitle => 'Rappels J-7 / J-2 et envois coaches';
  String get notifRsvp => 'Réponses RSVP';
  String get notifRsvpSubtitle => 'Quand un membre répond Présent / Absent';
  String get notifAnnouncements => 'Annonces';
  String get notifAnnouncementsSubtitle => 'À la publication d’une annonce';
  String get notifFees => 'Cotisations';
  String get notifFeesSubtitle => 'Rappel chaque lundi soir';
  String get disableNotificationsTitle => 'Désactiver les notifications';
  String get disableAction => 'Désactiver';
  String get notifPrefSaveFailed =>
      'Impossible d’enregistrer la préférence';
  String get notifOffWarningEvents =>
      'Tu ne recevras plus les rappels d’événements (J-7, J-2) ni les notifications envoyées par les coaches.';
  String get notifOffWarningAnnouncements =>
      'Tu ne recevras plus de notification à la publication des annonces du club.';
  String get notifOffWarningFees =>
      'Tu ne recevras plus les rappels hebdomadaires de cotisation.';
  String get notifOffWarningRsvp =>
      'Tu ne recevras plus de notification à chaque changement de RSVP.';
  String get notifOffWarningDefault =>
      'Tu ne recevras plus ce type de notification.';

  String get sessionSection => 'Session';
  String get sessionSubtitle =>
      'Actions sensibles — une confirmation te sera demandée.';
  String get signOut => 'Se déconnecter';
  String get signOutSubtitle => 'Quitter la session sur cet appareil';
  String get signOutDialogBody =>
      'Tu quittes la session sur cet appareil. '
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
  String get currentPassword => 'Mot de passe actuel';
  String get wrongPassword => 'Mot de passe incorrect';
  String get deleteFailed => 'Suppression impossible';
  String get notConnected => 'Aucun utilisateur connecté';

  String get changeEmailTitle => 'Changer l’e-mail';
  String get newEmail => 'Nouvel e-mail';
  String get googleConfirmEmailChange =>
      'Une fenêtre Google s’ouvrira pour confirmer le changement.';
  String get emailVerificationSent =>
      'E-mail de vérification envoyé. Profil mis à jour.';

  String get changePasswordTitle => 'Changer le mot de passe';
  String get newPassword => 'Nouveau mot de passe';
  String get confirmPassword => 'Confirmer';
  String get passwordsMismatch =>
      'Les mots de passe ne correspondent pas.';
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
