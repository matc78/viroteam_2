part of 'app_copy.dart';

/// Membres, invitations, parents, bulk actions.
final class AppCopyMembers {
  const AppCopyMembers();

  String get screenTitle => 'Membres';
  String get manageTitle => 'Gérer les membres';
  String get actions => 'Actions';
  String get clubNotFound => 'Club introuvable';
  String get empty => 'Effectif encore vide — ajoute ton premier joueur.';
  String get emptySearch => 'Aucun membre trouvé';
  String get tabMembers => 'Membres';
  String get tabTeams => 'Équipes';
  String get tabParents => 'Parents';
  String get tabCoaches => 'Coachs';
  String get filterPlayers => 'Joueurs';
  String get filterAdmins => 'Admins';
  String get searchMemberHint => 'Chercher un membre…';
  String get unnamed => 'Sans nom';

  String get deleteMemberTitle => 'Supprimer ce membre ?';
  String deleteMemberBody(String name) =>
      '$name sera retiré(e) du club.';
  String get deleteMemberAction => 'Supprimer';
  String get deleteMemberConfirm => 'Confirmer la suppression';
  String deleteMemberNamed(String name) =>
      'Confirmer la suppression de $name ?';
  String get deleteMemberButton => 'Supprimer le membre';
  String get removeMemberImpossible => 'Suppression du membre impossible.';

  String get noUnregisteredWithEmail =>
      'Personne à inviter : aucun non inscrit avec e-mail.';
  String get inviteSendFailed => 'Impossible d\'envoyer l\'invitation.';
  String get inviteSendImpossible => 'Envoi des invitations impossible.';
  String get inviteSendImpossibleSingular =>
      'Envoi de l\'invitation impossible.';
  String get inviteAlreadyBusy => 'Envoi déjà en cours…';
  String bulkInviteCooldown(String formatted) =>
      'Prochain envoi groupé dans $formatted.';
  String get inviteAllConfirmTitle => 'Inviter les non inscrits ?';
  String inviteAllConfirmBody(int count) =>
      'Un e-mail avec le code d’inscription sera envoyé à '
      '$count membre${count > 1 ? 's' : ''} '
      'non inscrit${count > 1 ? 's' : ''}.\n\n'
      'Limite : 1 envoi groupé par heure. '
      'Les invitations individuelles ou sur sélection restent libres.';
  String get preparingCodes => 'Préparation des codes…';
  String get inviteSendingPhase => 'Envoi des invitations…';
  String memberFallback(int index) => 'Membre $index';
  String get sendFailedShort => 'Échec d’envoi';
  String get sending => 'Envoi…';
  String inviteAllRetryIn(String cooldown) => 'Réessayer dans $cooldown';
  String inviteAllLabel(int count) => 'Inviter les non inscrits ($count)';

  String get pleaseWait => 'Patiente un instant…';
  String get preparing => 'Préparation…';
  String get stayOnScreenDuringSend =>
      'Reste sur cet écran pendant l’envoi.';

  String get sendInvite => 'Envoyer l\'invitation';
  String get inviteSentShort => 'Envoyée';
  String get inviteFailedShort => 'Échec';

  String get save => 'Enregistrer';
  String get saving => 'Enregistrement…';
  String get addPhone => 'Ajouter un numéro';
  String get noParentLinked => 'Aucun parent lié';
  String get loadParentError =>
      'Impossible de charger le parent pour le moment.';
  String get noParentInviteHint =>
      'Aucun parent lié. Invite un parent pour qu’il suive '
      'ton planning et ta cotisation.';
  String get notRegisteredYet => 'Pas encore inscrit';
  String get pendingIdentityHint =>
      'Pas encore inscrit — modifie l’identité ou partage le code.';
  String get parentsEmpty =>
      'Aucun parent pour l’instant — invite le premier.';
  String get loadParentsError => 'Impossible de charger les parents';
  String get searchParentHint => 'Chercher un parent…';
  String get filterPending => 'En attente';
  String get filterConnected => 'Connectés';
  String get coachLabel => 'Coach';
  String get removeFromTeam => 'Retirer de l\'équipe';
  String get noActionForSelection =>
      'Aucune action dispo pour cette sélection.';
  String get noPlayerAdded => 'Aucun joueur ajouté';
  String get identityLocked =>
      'Impossible de modifier l\'identité d\'un membre déjà inscrit.';

  String get roleChangeImpossible => 'Changement de rôle impossible.';
  String get roleUpdated => 'Rôle mis à jour — c’est bon.';
  String get memberRemoved => 'Membre retiré du club';
  String get changeRole => 'Changer le rôle';
  String roleOf(String name) => 'Rôle de $name';

  String get messageCopied => 'Message copié — prêt à coller.';
  String get inviteMessageCopied => 'Message d’invitation copié';
  String get copyInviteCodeTooltip => 'Copier le code d\'invitation';
  String get copyMessage => 'Copier le message';

  String get sessionExpired => 'Session expirée.';
  String get createMemberImpossible => 'Création du membre impossible.';
  String get addMemberTitle => 'Ajouter un membre';
  String get firstNameRequired => 'Prénom *';
  String get lastNameRequired => 'Nom *';
  String get emailRequired => 'E-mail *';
  String get emailInviteHint =>
      'seul ce compte pourra accepter l\'invitation';
  String get emailInviteHintCurly =>
      'seul ce compte pourra accepter l’invitation';
  String get creating => 'Création…';
  String get createAndInvite => 'Créer et inviter';
  String get inviteCreated => 'Invitation créée — à partager.';
  String memberAddedShareCode(String? displayName) =>
      '${displayName ?? ''} a été ajouté·e. Partage ce code :';

  String get editLicense => 'Modifier la licence';
  String get licenseNumberHint => 'Numéro de licence';
  String get licenseUpdated => 'Licence mise à jour';
  String get licenseUpdateImpossible =>
      'Modification de la licence impossible.';
  String get accountLinked => 'Compte lié';
  String get sectionInfo => 'Informations';
  String get sectionAdmin => 'Administration';
  String get labelRegistration => 'Inscription';
  String get labelEmail => 'E-mail';
  String get labelTeams => 'Équipes';
  String get labelFee => 'Cotisation';
  String get labelLicense => 'Licence';
  String get labelParent => 'Parent';
  String get labelRole => 'Rôle';
  String get parentInvited => 'Parent invité';
  String get inviteExpiredLower => 'invitation expirée';
  String get pendingLower => 'en attente';
  String parentWithInviteExpired(String name) =>
      '$name · invitation expirée';
  String parentWithPending(String name) => '$name · en attente';
  String enlargePhoto(String fullName) =>
      'Agrandir la photo de $fullName';

  String get statusConnected => 'Connecté';
  String get statusPending => 'En attente';
  String inviteExpiredOn(String dateLabel) => 'Expirée le $dateLabel';
  String pendingValidUntil(String dateLabel) =>
      'En attente · valable jusqu’au $dateLabel';

  String get revokeParentTitle => 'Révoquer ce parent ?';
  String revokeParentBody(String childName) =>
      'Le parent n’aura plus accès au suivi de $childName.';
  String get parentRevoked => 'Parent révoqué';
  String inviteExtendedUntil(String dateLabel) =>
      'Prolongée jusqu’au $dateLabel';
  String get inviteExtended => 'Invitation prolongée';
  String newInviteCode(String code) => 'Nouveau code : $code';
  String get changeEmailTitle => 'Changer l’e-mail';
  String get parentEmailLabel => 'E-mail du parent';
  String get emailUpdated => 'E-mail mis à jour';
  String get allPlayersHaveParent => 'Tous les joueurs ont déjà un parent';
  String get inviteParentTitle => 'Inviter un parent';
  String get childLabel => 'Enfant';
  String get invalidEmail => 'Saisis un e-mail valide';
  String get parentInvitedMessageCopied => 'Parent invité — message copié';
  String get inviteSentMessageCopied => 'Invitation envoyée — message copié';
  String childrenList(String names) => 'Enfant(s) : $names';
  String revokeNamed(String childName) => 'Révoquer ($childName)';

  String get myParentTitle => 'Mon parent';
  String get manageMyParent => 'Gérer mon parent';
  String get inviteParent => 'Inviter un parent';
  String parentOf(String childFirstName) => 'Parent de $childFirstName';
  String get parentSheetHint =>
      'Un parent par enfant. Il pourra voir le planning, '
      'répondre aux convocations et payer la cotisation.';
  String inviteCodeLabel(String code) => 'Code : $code';

  String get pendingMemberTitle => 'Membre en attente';
  String get identityUpdated => 'Identité mise à jour';
  String get parentAccess => 'Accès parent';
  String get inviteCodeSection => 'Code d’invitation';
  String get saveToEnableEmailSend =>
      'Enregistre pour activer l’envoi par e-mail.';

  String get sendInvitesTitle => 'Envoyer les invitations';
  String eligibleUnregisteredWithEmail(int count) =>
      '$count non inscrit${count > 1 ? 's' : ''} avec e-mail.';
  String get addToTeamTitle => 'Ajouter à une équipe';
  String playersSelected(int count) =>
      '$count joueur${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}.';
  String selectedMembersCount(int count) =>
      '$count membre${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}';
  String get chooseTeam => 'Choisir une équipe';
  String get addToTeamImpossible => 'Ajout à l’équipe impossible.';
  String playersAddedToTeam({
    required int added,
    required String teamName,
    required int skipped,
  }) {
    final base =
        '$added joueur${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''} à $teamName';
    if (skipped > 0) {
      return '$base ($skipped déjà dans l’équipe).';
    }
    return '$base.';
  }

  String noPlayerAddedDetail({required int skipped}) {
    if (skipped > 0) {
      return 'Aucun joueur ajouté (déjà dans l’équipe).';
    }
    return 'Aucun joueur ajouté.';
  }

  String get teamRoleCoach => 'coach';
  String get teamRolePlayer => 'joueur';

  String inviteSendSummary({
    required int sent,
    required int skipped,
    required int failed,
    String? reasonsSuffix,
  }) {
    final summary = StringBuffer(
      '$sent invitation${sent > 1 ? 's' : ''} '
      'envoyée${sent > 1 ? 's' : ''}',
    );
    if (skipped > 0) {
      summary.write(', $skipped ignorée${skipped > 1 ? 's' : ''}');
    }
    if (failed > 0) {
      summary.write(', $failed erreur${failed > 1 ? 's' : ''}');
    }
    summary.write('.');
    if (reasonsSuffix != null && reasonsSuffix.isNotEmpty) {
      summary.write(' Motifs : $reasonsSuffix');
    }
    return summary.toString();
  }

  String get unknownReason => 'Motif inconnu';
}
