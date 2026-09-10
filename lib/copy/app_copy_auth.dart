part of 'app_copy.dart';

/// Auth, onboarding, login / signup.
final class AppCopyAuth {
  const AppCopyAuth();

  String get welcomeTitle => 'Bienvenue sur ViroTeam';
  String get welcomeSubtitle =>
      'Ton club, ton vestiaire digital : planning, convoc’, cotisations.';
  String get benefitPlanning => 'Pose tes entraînements et matchs';
  String get benefitRsvp => 'Suis les réponses aux convocations';
  String get benefitComms => 'Reste branché avec ton club';
  String get hasInviteCode => 'J\'ai un code d\'invitation';
  String get createClub => 'Créer mon club';
  String get alreadyHaveAccount => 'Déjà un compte ? Se connecter';
  String get signOut => 'Se déconnecter';

  String get orphanAccountTitle => 'Compte ViroTeam introuvable';
  String get orphanAccountHint =>
      'Tu es connecté(e) mais tu n’as pas encore de '
      'compte sur cet environnement. Crée ton compte '
      'ou rejoins un club avec un code d’invitation.';

  String get loginTitle => 'Connexion';
  String get signUpTitle => 'Créer un compte';
  String get completeProfileTitle => 'Créer ton compte ViroTeam';
  String get founderAccountTitle => 'Compte fondateur';
  String get email => 'E-mail';
  String get emailFieldLabel => 'Email';
  String get password => 'Mot de passe';
  String get forgotPassword => 'Mot de passe oublié ?';
  String get signInAction => 'Se connecter';
  String get orDivider => 'ou';
  String get continueWithGoogle => 'Continuer avec Google';

  String get firstName => 'Prénom';
  String get lastName => 'Nom';
  String get firstNameHint => 'Tristan';
  String get lastNameHint => 'Heraud';
  String get acceptTermsLabel =>
      'J’accepte les CGU et la politique de confidentialité.';
  String get termsCgu => 'CGU';
  String get termsPrivacy => 'Confidentialité';
  String get createMyAccount => 'Créer mon compte';
  String get createMyAccountViroTeam => 'Créer mon compte ViroTeam';
  String get useAnotherAccount => 'Utiliser un autre compte';
  String get completeProfileHint =>
      'Tu es connecté(e) mais tu n’as pas encore de compte '
      'ViroTeam sur cet environnement. Complète ton profil pour '
      'continuer.';

  String get showPassword => 'Afficher le mot de passe';
  String get hidePassword => 'Masquer le mot de passe';
  String get invalidEmail => 'Email invalide';
  String get passwordMin6 => '6 caractères minimum';

  String get loginFailedRetry =>
      'Connexion impossible. Réessaie dans un instant.';
  String get loginFailedCredentials =>
      'Connexion impossible. Vérifie ton e-mail et ton mot de passe.';
  String get googleLoginFailed =>
      'Connexion Google impossible. Réessaie.';
  String get googleSignUpFailed =>
      'Inscription Google impossible. Réessaie.';
  String get accountCreateFailed =>
      'Création du compte impossible. Réessaie.';
  String get acceptTermsRequired =>
      'Tu dois accepter les CGU et la politique de confidentialité.';
  String get firebaseUserMissingAfterGoogle =>
      'Utilisateur Firebase absent après Google Sign-In';

  String get passwordHint =>
      '8 caractères minimum, avec une majuscule, une minuscule et un chiffre.';
  String get passwordRequired => 'Le mot de passe est requis.';
  String passwordMinLength(int minLength) =>
      'Au moins $minLength caractères.';
  String get passwordNeedUpper => 'Au moins une majuscule.';
  String get passwordNeedLower => 'Au moins une minuscule.';
  String get passwordNeedDigit => 'Au moins un chiffre.';

  String get authErrorInvalidEmail => 'Adresse e-mail invalide.';
  String get authErrorUserDisabled => 'Ce compte est désactivé.';
  String get authErrorWrongCredentials =>
      'E-mail ou mot de passe incorrect.';
  String get authErrorEmailAlreadyInUse =>
      'Un compte existe déjà avec cet e-mail.';
  String get authErrorWeakPassword =>
      'Mot de passe trop faible (8 caractères minimum).';
  String get authErrorTooManyRequests =>
      'Trop de tentatives. Réessaie plus tard.';
  String get authErrorNetworkFailed =>
      'Problème réseau. Vérifie ta connexion.';
  String get authErrorAccountExistsDifferentCredential =>
      'Un compte existe déjà avec cet e-mail. Connecte-toi avec ton mot de passe.';
  String get authErrorRequiresRecentLogin =>
      'Reconnecte-toi pour confirmer cette action.';
}
