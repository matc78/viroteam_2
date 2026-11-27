part of 'app_copy.dart';

/// Textes des outils d'entraînement : préparation de séance (notes,
/// exercices, tableau blanc) et retours de séance (notes collectives,
/// messages perso).
final class AppCopyTraining {
  const AppCopyTraining();

  // ——— Fiche d'événement ———
  String get prepareAction => 'Préparer l’entraînement';
  /// Libellé compact (grille d’actions du détail événement).
  String get prepareActionShort => 'Préparer';
  String get myPrepAction => 'Ma préparation';
  String get feedbackAction => 'Faire le retour';
  String get feedbackSentAction => 'Retour envoyé · modifier';
  String get reviewAction => 'Consulter les retours';

  // ——— Liste des entraînements passés ———
  String get listTitle => 'Feedback entraînement';
  String get listEmptyTitle => 'Pas encore d’entraînement passé';
  String get listEmptyHint =>
      'Après ta prochaine séance, c’est ici que tu feras le retour.';
  String get listLoadError => 'Impossible de charger tes entraînements.';
  String get loadMore => 'Voir plus ancien';
  String get statusTodo => 'À faire';
  String get statusSent => 'Envoyé';
  String get statusSkipped => 'Flemme';
  String statusLabel(TrainingFeedbackStatus status) => switch (status) {
        TrainingFeedbackStatus.todo => statusTodo,
        TrainingFeedbackStatus.sent => statusSent,
        TrainingFeedbackStatus.skipped => statusSkipped,
      };
  String eventSemantics({
    required String title,
    required String date,
    required TrainingFeedbackStatus status,
  }) =>
      '$title, $date, ${statusLabel(status)}';
  String get skipHint => 'Appui long : pas de retour pour cette séance';
  String get unskipHint => 'Appui long : remettre en À faire';
  String get skippedToast => 'Flemme assumée, la séance sort de tes rappels.';
  String get unskippedToast => 'Séance remise en À faire.';
  String get skipFailed => 'Pas enregistré, vérifie ta connexion.';
  String colleagueFeedbackTitle(String coachName) =>
      coachName.isEmpty ? 'Retour d’un autre coach' : 'Retour de $coachName';
  String get colleagueFeedbackSubtitle => 'Envoyé · à consulter';
  String colleagueFeedbackSemantics(String coachName) =>
      '${colleagueFeedbackTitle(coachName)}, ouvrir';

  // ——— Saisie du retour ———
  String get feedbackTitle => 'Retour de séance';
  String get collectiveSection => 'Le collectif';
  String get levelLabel => 'Niveau de jeu';
  String get levelHint => 'Le niveau proposé par l’équipe aujourd’hui';
  String get engagementLabel => 'Envie / participation';
  String get engagementHint => 'L’énergie et l’implication du groupe';
  String ratingSemantics(String label, double value, int max) =>
      '$label : ${_formatRating(value)} sur $max';
  String ratingOptionSemantics(double value) =>
      'Note ${_formatRating(value)}';
  /// Affiche `4` ou `3.5` selon la note (demi-étoiles).
  String _formatRating(double value) =>
      value == value.roundToDouble()
          ? '${value.round()}'
          : value.toStringAsFixed(1);
  String get collectiveMessageLabel => 'Un mot au collectif (facultatif)';
  String get collectiveMessageHint => 'Ce que toute l’équipe va lire';
  String get playersSection => 'Un mot perso (facultatif)';
  String get playersHint =>
      'Seul le joueur (et ses parents) verra ton message. Pas de note '
      'individuelle, juste un mot qui aide.';
  String get playersEmpty => 'Aucun joueur convoqué sur cette séance.';
  String get playerMessageHint => 'Ton message pour ce joueur';
  String get playerMessageWritten => 'Mot écrit';
  String get playerMessageCollapse => 'Replier';
  String playerMessageSemantics(String name, bool hasMessage) =>
      hasMessage ? '$name, message écrit' : '$name, pas de message';
  String get ratingsRequired => 'Mets les deux notes du collectif pour envoyer.';
  String sendAction(int messageCount) => messageCount == 0
      ? 'Envoyer le retour'
      : 'Envoyer le retour (+$messageCount mot${messageCount > 1 ? 's' : ''})';
  String get resendAction => 'Mettre à jour le retour';
  String get sendConfirmTitle => 'Envoyer le retour ?';
  String sendConfirmBody(int messageCount) =>
      'Les notes et le mot au collectif seront visibles par toute l’équipe '
      'et les parents. '
      '${messageCount == 0 ? '' : '$messageCount message${messageCount > 1 ? 's' : ''} perso partira aussi au joueur concerné et à ses parents. '}'
      'Les admins du club peuvent consulter les retours envoyés.';
  String get resendConfirmBody =>
      'Ton retour déjà envoyé sera remplacé par cette version. Pas de '
      'nouvelle notification.';
  String get sendConfirm => 'Envoyer';
  String get sending => 'Envoi…';
  String get sent => 'Retour envoyé, merci coach !';
  String get updated => 'Retour mis à jour.';
  String get sendFailed => 'Le retour n’est pas parti. Réessaie.';
  String get draftSaveFailed => 'Brouillon non enregistré, vérifie ta connexion.';
  String get loadError => 'Impossible de charger cet entraînement.';
  String get notCoach => 'Seuls les coachs de l’équipe font ce retour.';
  String get notPastYet => 'Le retour se fait une fois la séance passée.';

  // ——— Consultation des retours ———
  String get reviewTitle => 'Retours de la séance';
  String get reviewEmpty => 'Aucun retour envoyé pour cette séance.';
  String get reviewReadOnly =>
      'Lecture seule : ce que les coachs ont envoyé aux joueurs et parents.';
  String reviewCoach(String coachName) =>
      coachName.isEmpty ? 'Coach' : 'Coach $coachName';
  String get reviewNoPlayerMessage => 'Pas de message perso.';
  String get reviewPlayerMessages => 'Messages perso';
  String get unknownPlayer => 'Joueur';

  // ——— Bloc reçu (joueur / parent) ———
  String get receivedTitle => 'Retour du coach';
  String receivedFrom(String coachName) =>
      coachName.isEmpty ? 'Ton coach' : coachName;
  String get receivedPersonal => 'Pour toi';
  String receivedPersonalFor(String firstName) => 'Pour $firstName';
  String get receivedScreenTitle => 'Retour du coach';
  String receivedIntro(int coachCount) => coachCount > 1
      ? 'Tes $coachCount coachs ont fait le point sur la séance.'
      : 'Ton coach a fait le point sur la séance.';
  String get receivedEmpty => 'Pas encore de retour sur cette séance.';
  String get reviewReceivedAction => 'Revoir le retour du coach';

  // ——— Page Feedback (en-tête de l'accueil) ———
  String get hubTitle => 'Feedback';
  String hubButtonTooltip({required int unseen, required int pending}) => [
        'Feedback',
        if (pending > 0) '$pending à faire',
        if (unseen > 0) '$unseen à lire',
      ].join(', ');
  String get hubTabManage => 'Gestion';
  String get hubTabMine => 'Pour moi';
  String hubManageIntro(int pending) => switch (pending) {
        0 => 'Tous tes retours sont faits. Propre, coach.',
        1 => '1 séance attend ton retour.',
        _ => '$pending séances attendent ton retour.',
      };
  String hubManageHint(int windowDays) =>
      'Le compteur ne garde que les séances des $windowDays derniers jours, '
      'les plus anciennes restent faisables dans la liste. Appui long sur '
      'une séance à faire pour passer ton tour.';
  String hubMineIntro(int unseen) => switch (unseen) {
        0 => 'Tout est lu. Rendez-vous à la prochaine séance.',
        1 => '1 retour tout frais à lire.',
        _ => '$unseen retours tout frais à lire.',
      };
  String get hubManageEmptyTitle => 'Rien à gérer pour l’instant';
  String get hubManageEmptyHint =>
      'Les entraînements passés de tes équipes arriveront ici.';
  String get hubMineEmptyTitle => 'Pas encore de retour';
  String get hubMineEmptyHint =>
      'Après l’entraînement, le mot de ton coach atterrit ici.';
  String get hubOtherTeams => 'Autres équipes du club';
  String get hubSeeAll => 'Voir tous les entraînements';
  String get receivedNew => 'Nouveau';
  String receivedCoaches(List<String> names, int count) {
    final known = names.where((name) => name.trim().isNotEmpty).toList();
    if (known.isEmpty) {
      return count > 1 ? '$count coachs' : 'Ton coach';
    }
    return known.length == 1
        ? 'Coach ${known.single}'
        : 'Coachs ${known.join(', ')}';
  }
  String receivedForChild(String firstName) => 'Pour $firstName';
  String receivedTileSemantics({
    required String title,
    required String date,
    required bool isNew,
  }) =>
      '$title, $date${isNew ? ', nouveau retour' : ''}';
  String reviewCount(int count) =>
      count > 1 ? '$count retours' : '1 retour';
  String reviewTileSemantics(String title, String date, int count) =>
      '$title, $date, ${reviewCount(count)}, consulter';

  // ——— Préparation ———
  String get prepTitle => 'Préparation';
  String get prepMine => 'Moi';
  String prepColleague(String coachName) =>
      coachName.isEmpty ? 'Coach' : coachName;
  String get prepReadOnly => 'Préparation d’un collègue, en lecture seule.';
  String get prepEmptyColleague => 'Rien de préparé pour l’instant.';
  String get notesLabel => 'Notes libres';
  String get notesHint => 'Objectifs, rappels, idées en vrac…';
  String get drillsSection => 'Exercices';
  String get drillsEmpty => 'Aucun exercice. Ajoute le premier !';
  String get addDrill => 'Ajouter un exercice';
  String plannedDuration(int planned, int? session) => session == null
      ? '$planned min prévues'
      : '$planned min prévues / $session min de séance';
  String drillDuration(int minutes) => '$minutes min';
  String untitledDrill(int position) => 'Exo $position';
  String drillSemantics(String title, int? minutes) =>
      minutes == null ? title : '$title, $minutes minutes';
  String get reorderHint => 'Appui long pour réordonner';
  String get saveFailed => 'Pas enregistré, vérifie ta connexion.';
  String get saved => 'Enregistré';
  String get copyToMyPrep => 'Copier dans ma préparation';
  String drillsCopied(int count) => count > 1
      ? '$count exercices copiés dans ta préparation.'
      : 'Exercice copié dans ta préparation.';

  // ——— Bibliothèque ———
  String get libraryAction => 'Bibliothèque';
  String get libraryTitle => 'Bibliothèque';
  String get libraryIntro => 'Séances passées de tes équipes, sur 6 mois.';
  String get libraryTabSessions => 'Séances';
  String get libraryTabDrills => 'Exercices';
  String get librarySearchHint => 'Rechercher un exercice, une séance…';
  String get libraryLoadError => 'Impossible de charger la bibliothèque.';
  String get libraryEmptySessions =>
      'Aucune séance préparée pour l’instant. Le banc se remplira vite !';
  String get libraryEmptyDrills => 'Aucun exercice pour l’instant.';
  String get libraryNoMatch => 'Rien ne correspond à ta recherche.';
  String get libraryOpenSession => 'Consulter';
  String get libraryDuplicate => 'Dupliquer dans cette séance';
  String get libraryDuplicated => 'Dupliquée';
  String get libraryAddDrill => 'Ajouter à la séance';
  String get libraryDrillAdded => 'Ajouté';
  String get libraryUntitledDrill => 'Exercice';
  String get libraryDefaultTeams => 'Entraînement';
  String libraryCoach(String name) => name.trim().isEmpty ? 'Coach' : name;
  String librarySessionMeta(String coach, int drills, int minutes) {
    final count = drills > 1 ? '$drills exercices' : '$drills exercice';
    return minutes > 0 ? '$coach · $count · $minutes min' : '$coach · $count';
  }

  // ——— Exercice ———
  String get drillTitle => 'Exercice';
  String get drillNameLabel => 'Titre';
  String get drillNameHint => 'Ex. Service-réception en 3 contre 3';
  String get drillDurationLabel => 'Durée (min)';
  String get drillInstructionsLabel => 'Consignes';
  String get drillInstructionsHint => 'Déroulé, variantes, points clés…';
  String get drillBoardLabel => 'Schémas';
  String get drillBoardAdd => 'Ajouter un schéma';
  String get drillBoardEmpty => 'Pas encore de schéma';
  String get drillBoardLimit => 'Maximum 6 schémas par exercice.';
  String get drillBoardDelete => 'Supprimer ce schéma';
  String get drillBoardDeleteTitle => 'Supprimer ce schéma ?';
  String get drillBoardDeleteBody =>
      'Ce schéma sera retiré de l’exercice. Cette action est définitive.';
  String get drillBoardDeleteConfirm => 'Supprimer';
  String drillBoardCount(int count) => '$count';
  String get deleteDrill => 'Supprimer l’exercice';
  String get deleteDrillTitle => 'Supprimer cet exercice ?';
  String get deleteDrillBody =>
      'Le titre, les consignes et les schémas seront effacés.';
  String get deleteDrillConfirm => 'Supprimer';

  // ——— Tableau blanc ———
  String get boardTitle => 'Schéma';
  String get boardPen => 'Crayon';
  String get boardArrow => 'Flèche';
  String get boardPlayer => 'Ajouter un joueur';
  String get boardOpponent => 'Ajouter un adversaire';
  String get boardBall => 'Ajouter le ballon';
  String get boardMove => 'Déplacer';
  String get boardUndo => 'Annuler';
  String get boardClear => 'Tout effacer';
  String get boardClearTitle => 'Tout effacer ?';
  String get boardClearBody => 'Les traits et les jetons du schéma seront retirés.';
  String get boardClearConfirm => 'Effacer';
  String get boardCourtFull => 'Terrain entier';
  String get boardCourtHalf => 'Demi-terrain';
  String get boardCourtBlank => 'Tableau blanc';
  String get boardInkAccent => 'Encre bleue';
  String get boardInkRed => 'Encre rouge';
  String get boardInkDark => 'Encre sombre';
  String get boardDone => 'Valider';
  String get boardSemantics => 'Schéma d’exercice';
  String get boardLimitReached => 'Schéma plein : efface un élément pour continuer.';
  String get boardDeleteArrow => 'Supprimer la flèche';
  String get boardPlayerLabelTitle => 'Numéro du joueur';
  String get boardOpponentLabelTitle => 'Numéro de l’adversaire';
  String get boardLabelHint => 'Ex. 7';
  String get boardLabelSave => 'OK';
}
