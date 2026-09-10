part of 'app_copy.dart';

/// Codes d’invitation, rejoindre un club.
final class AppCopyJoin {
  const AppCopyJoin();

  String get inviteAcceptFailed =>
      'Impossible d\'accepter l\'invitation.';

  String get joinClubTitle => 'Rejoindre un club';
  String get enterCodeTitle => 'Entre ton code';
  String get enterCodeSubtitle =>
      'Demande le code d\'invitation à ton entraîneur ou à l\'admin du club.';
  String get codeHint => 'ASMP1K2E';
  String get validateCode => 'Valider le code';
  String get askYourCoach => 'Demande à ton coach';
  String get codeNotFoundOrExpired => 'Code introuvable ou expiré.';

  String get requestRoleTitle => 'Demander un rôle';
  String get requestRoleSubtitle =>
      'Ton code te donne un rôle de départ. Tu peux en demander un autre aux admins.';
  String get desiredRole => 'Rôle souhaité';
  String get optionalMessage => 'Message (optionnel)';
  String get sendRequest => 'Envoyer la demande';
  String get chooseDifferentRole => 'Choisis un rôle différent.';
  String get requestSent => 'Demande envoyée aux admins — ils vont voir ça.';

  String get invitationTitle => 'Invitation';
  String get enterACode => 'Saisir un code';
  String get invitedToJoin => 'Tu es invité à rejoindre';
  String get guardianInviteHeadline => 'Invitation pour suivre un enfant';
  String guardianInviteBody(String childFirstName) =>
      'Tu pourras voir le planning de $childFirstName, '
      'répondre aux convocations et payer la cotisation.';
  String get defaultChildName => 'ton enfant';
  String proposedRole(String roleLabel) => 'Rôle proposé : $roleLabel';
  String get memberAlsoPlayerAccess =>
      'En tant que membre du club, tu auras aussi accès aux fonctions joueur.';
  String reservedForAccount(String email) =>
      'Invitation réservée au compte $email';
  String get acceptInvitation => 'Accepter l\'invitation';
  String get declineInvitation => 'Refuser';

  String clubInviteMessage({
    required String clubName,
    required String code,
    required String joinUrl,
    required String storeLine,
  }) =>
      '''Rejoins $clubName sur ViroTeam !

Ton code : $code

Valable 7 jours.

Lien : $joinUrl$storeLine

Ou ouvre l'app → « J'ai un code d'invitation » et saisis ce code.''';

  String guardianInviteShareMessage({
    required String childFirstName,
    required String clubName,
    required String code,
  }) =>
      '''Tu pourras voir le planning de $childFirstName, répondre aux convocations et payer la cotisation.

Club : $clubName

Code : $code

Ouvre l'app → « J'ai un code d'invitation » et saisis ce code.''';
}
