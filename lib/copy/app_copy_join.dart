part of 'app_copy.dart';

/// Codes d’invitation, rejoindre un club.
///
/// Messages de partage WhatsApp/SMS (voix Guy).
/// Les e-mails transactionnels Brevo : `functions/src/email/emailCopy.ts`.
final class AppCopyJoin {
  const AppCopyJoin();

  String get inviteAcceptFailed => 'Impossible d\'accepter l\'invitation.';
  String get reservedForOtherEmail =>
      'Cette invitation est réservée à un autre e-mail. '
      'Demande à l\'administrateur du club de renvoyer un code à ton adresse.';
  String get useGuardianService =>
      'Utiliser GuardianService.linkGuardian pour une invitation parent.';
  String get useTeamInviteService =>
      'Utiliser InvitationService.acceptTeamInvitation pour un code d\'équipe.';

  String get joinClubTitle => 'Rejoindre un club';
  String get enterCodeTitle => 'Entre ton code';
  String get enterCodeSubtitle =>
      'Demande le code d\'invitation à ton entraîneur ou à l\'admin du club.';
  String get codeHint => 'ASMP1K2E';
  String get validateCode => 'Valider le code';
  String get askYourCoach => 'Demande à ton coach';
  String get codeNotFoundOrExpired => 'Code introuvable ou expiré.';
  String get teamInviteCreateFailed =>
      'Impossible de créer le code d\'équipe.';
  String get teamInviteRevokeFailed =>
      'Impossible de révoquer le code d\'équipe.';
  String get inviteTeamTitle => 'Inviter l\'équipe';
  String get inviteTeamSubtitle =>
      'Partage ce code : tes joueurs rejoignent le club et l\'équipe directement.';
  String get shareTeamCode => 'Partager le lien';
  String get copyTeamCode => 'Copier le code';
  String get regenerateTeamCode => 'Régénérer';
  String get revokeTeamCode => 'Révoquer';
  String get teamCodeCopied => 'Code copié.';
  String get teamLinkCopied => 'Lien copié.';
  String get teamCodeRevoked => 'Code révoqué.';
  String teamInviteUses(int useCount, int maxUses) =>
      '$useCount / $maxUses utilisations';
  String teamInviteExpires(String dateLabel) => 'Valable jusqu\'au $dateLabel';
  String teamInviteHeadline(String teamName, String clubName) =>
      'Tu rejoins $teamName — $clubName';
  String get teamInviteBody =>
      'Tu seras ajouté à l\'équipe tout de suite, sans validation.';
  String get acceptTeamInvitation => 'Rejoindre l\'équipe';

  String teamInviteShareMessage({
    required String clubName,
    required String teamName,
    required String code,
    required String joinUrl,
    required String appStoreUrl,
    required String playStoreUrl,
    required String siteUrl,
  }) =>
      '''Salut !

Rejoins $teamName ($clubName) sur ViroTeam pour les convocations.

Ton code : $code
Valable ${TeamInviteLimits.ttlDays} jours (max ${TeamInviteLimits.maxUses} joueurs via ce lien).
App Store : $appStoreUrl
Google Play : $playStoreUrl

Ou ouvre l'app → « J'ai un code d'invitation » et tape ce code.

Aussi sur le web :
Site : $siteUrl
Espace club : $joinUrl

— Guy''';

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
    required String appStoreUrl,
    required String playStoreUrl,
    required String siteUrl,
  }) =>
      '''Salut !

On t'attend. Voilà ton code pour rejoindre $clubName sur ViroTeam.

Ton code : $code
Valable 7 jours.
App Store : $appStoreUrl
Google Play : $playStoreUrl

Ou ouvre l'app → « J'ai un code d'invitation » et tape ce code.

Aussi sur le web :
Site : $siteUrl
Espace club : $joinUrl

— Guy''';

  String guardianInviteShareMessage({
    required String childFirstName,
    required String clubName,
    required String code,
    required String joinUrl,
    required String appStoreUrl,
    required String playStoreUrl,
    required String siteUrl,
  }) =>
      '''Salut !

Tu pourras voir le planning de $childFirstName, répondre aux convocations et payer la cotisation — $clubName.

Ton code : $code
Valable 7 jours.
App Store : $appStoreUrl
Google Play : $playStoreUrl

Ou ouvre l'app → « J'ai un code d'invitation » et tape ce code.

Aussi sur le web :
Site : $siteUrl
Espace club : $joinUrl

— Guy''';
}
