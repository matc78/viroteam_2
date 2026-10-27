part of 'app_copy.dart';

/// Planning club / membre, événements, RSVP.
final class AppCopyPlanning {
  const AppCopyPlanning();

  String get screenTitle => 'Planning';
  /// Planning membre (home / 14 jours) — répondre aux convocations.
  String get memberScreenTitle => 'Mes prochains événements';
  /// Planning club — vue jour + création.
  String get clubScreenTitle => 'Planning du club';
  String get emptyDayAdmin =>
      'Rien de prévu ce jour-là.\nTape sur + pour poser un événement.';
  String get emptyDay => 'Rien de prévu ce jour-là.';
  String get emptyMember14d =>
      'Terrain libre sur les 14 prochains jours — profite-en.';
  String get noMembersCalled => 'Personne de convoqué pour l’instant';
  String get notRegisteredYet => 'Pas encore inscrit';
  /// Action AppBar du planning club → écran de synchro calendrier.
  String get syncCalendarTooltip => 'Synchroniser avec mon agenda';
  /// État vide (vue jour) quand un événement existe plus loin.
  String get goToNextEvent => 'Aller au prochain événement';
  /// État vide du planning membre (un seul club) : vers le planning du club.
  String get openClubPlanning => 'Voir le planning du club';
  String get openClubsPlanning => 'Voir le planning d’un club';
  String get pickClubPlanningTitle => 'Quel club ?';
  String get goToTodayTooltip => 'Aller à aujourd’hui';
  String get addEventTooltip => 'Créer un événement';
  String get noUpcomingClub => 'Rien à venir au planning';
  String get noUpcomingForSheet =>
      'Rien à venir pour cette fiche.';

  String get next14DaysTitle => '14 prochains jours';
  String get loadClubsError => 'Impossible de charger tes clubs';
  String get loadPlanningError => 'Impossible de charger le planning';
  String get rsvpFailed => 'RSVP impossible, réessaie';
  String get moreOptions => 'Plus d\'options';
  String get moreOptionsSubtitle => 'Rappel J-7, RDV, récurrence…';

  String get clubFallbackName => 'Club';
  String get allClub => 'Tout le club';
  String get fieldAudience => 'Convoqués';
  String get audienceTeams => 'Équipes';
  String get audienceWholeClubHint =>
      'Tous les membres du club le verront dans leur planning.';
  String get audienceNoTeams =>
      'Aucune équipe pour l’instant : convoque tout le club.';
  String get chooseAudienceTeams => 'Choisis au moins une équipe';
  String get unnamedMember => 'Sans nom';

  String get typeTraining => 'Entraînement';
  String get typeMatch => 'Match';
  String get typeTournament => 'Tournoi';
  String get typeMeeting => 'Réunion';
  String get typeOther => 'Autre';
  String get typeEvent => 'Événement';

  String eventType(String type) => switch (type) {
        'training' => typeTraining,
        'match' => typeMatch,
        'tournament' => typeTournament,
        'meeting' => typeMeeting,
        _ => typeEvent,
      };

  String get rsvpPresent => 'Présent';
  String get rsvpAbsent => 'Absent';
  String get rsvpPending => 'En attente';

  /// Lecteur d’écran : date du vote RSVP ([when] ex. « 12/10 à 13h45 »).
  String rsvpAnsweredAt(String when) => 'Répondu le $when';

  /// Icône « vu » : convocation vue sur la home, sans réponse.
  String seenNotAnswered(String when) =>
      'Vu le $when, pas encore répondu';

  /// Libellé lecteur d’écran pour un compteur RSVP (résumé).
  String rsvpCountLabel(String statusLabel, int count) =>
      '$count $statusLabel';

  String get newEventTitle => 'Nouvel événement';
  String get reservedToCoachesAdmins =>
      'Réservé aux coachs et admins';
  /// Raison du bouton Créer désactivé : lieu du RDV manquant.
  String get meetingLocationRequired => 'Choisis le lieu du RDV';
  /// Confirmation de sortie du formulaire d'événement modifié.
  String get discardEventTitle => 'Abandonner la saisie ?';
  String get discardEventBody => 'Ce que tu as rempli sera perdu.';
  String get discardEventConfirm => 'Abandonner';
  String get keepEditing => 'Continuer';
  String get fieldType => 'Type';
  String get fieldTeam => 'Équipe';
  String get chooseTeam => 'Choisir une équipe';
  String get fieldTitle => 'Titre';
  String get titleHint => 'Stage, soirée du club…';
  String get fieldTitleOptional => 'Titre (facultatif)';
  String get meetingTitleHint => 'AG, réunion des parents…';
  String get homeOrAway => 'Domicile ou extérieur';
  String get home => 'Domicile';
  String get away => 'Extérieur';
  String get matchVenue => 'Lieu du match';
  String get address => 'Adresse';
  String get addressHint => 'Rue, numéro ou lieu…';
  String get fieldLocation => 'Lieu';
  String get locationHint => 'Stade, gymnase…';
  String get matchDay => 'Jour du match';
  String get date => 'Date';
  String get matchTime => 'Heure du match';
  String get meetingTime => 'Heure de RDV';
  String get start => 'Début';
  String get end => 'Fin';
  String get weeklyRecurrence => 'Récurrence hebdomadaire';
  String get importantReminder => 'Événement important';
  String get importantReminderSubtitle =>
      'Rappel 7 jours avant en plus, pour ceux qui n’ont pas répondu';
  String get seasonEnd => 'Fin de saison';
  String get chooseDate => 'Choisir une date';
  String get seasonEndDefaultSubtitle =>
      'Par défaut : fin de saison du club';
  String get meetingLocation => 'Lieu du RDV';
  String get createSeries => 'Créer la série';
  String get createEvent => 'Créer l\'événement';

  String get chooseTeamSnack => 'Choisis une équipe';
  String get titleRequired => 'Titre requis';
  String get indicateHomeOrAway => 'Indique domicile ou extérieur';
  String get matchAddressRequired =>
      'Ville, code postal et adresse du match requis';
  String get endTimeAfterStart =>
      'L\'heure de fin doit être après le début';
  String get chooseEndDate => 'Choisis une date de fin';
  String get endDateAfterStart =>
      'La fin doit être après la date de début';
  String get locationRequired => 'Lieu requis';

  String eventsCreated(int count) =>
      count > 1 ? '$count événements posés — c’est calé.' : 'Événement posé — c’est calé.';

  String get notifSent => 'Notif envoyée';
  String get notifRateLimited =>
      'Une notification est déjà partie il y a moins d’une heure';
  String get notifSendFailed => 'Envoi impossible, réessaie';
  String responsesCount(int count) => 'Réponses ($count)';
  String get sendNotification => 'Envoyer une notification';
  String get sending => 'Envoi…';

  String get cancelEventTitle => 'Annuler l\'événement ?';
  String get cancelEventBody =>
      'Les membres ne verront plus cet événement dans leur planning.';
  String get cancelEventAction => 'Annuler l\'événement';
  String get cancelSeriesTitle => 'Annuler l\'événement';
  String get cancelSeriesBody =>
      'Cet entraînement fait partie d\'une série récurrente. '
      'Que veux-tu annuler ?';
  String get thisEventOnly => 'Cet événement seulement';
  String get wholeSeries => 'Toute la série';

  String get convocationSectionTitle => 'Joueurs convoqués';
  String convocationCount(int convoked, int total) =>
      '$convoked/$total convoqués';
  String get matchConvocationHint =>
      'Décoche ceux qui ne sont pas du match. Ils ne le verront pas.';
  String get teamNoPlayers => 'Aucun joueur dans cette équipe pour l’instant';
  String get keepOnePlayerConvoked => 'Garde au moins un joueur convoqué';
  String get notConvoked => 'Pas convoqué';
  String get manageConvocations => 'Gérer les convoqués';
  String get manageConvocationsSubtitle =>
      'Un joueur décoché ne voit plus l’événement et ne reçoit aucune notif.';
  String get convocationScopeTitle => 'Appliquer à quelles séances ?';
  String get convocationScopeBody =>
      'Cet entraînement fait partie d’une série récurrente.';
  String get thisSessionOnly => 'Cette séance';
  String get thisAndFollowing => 'Celle-ci et les suivantes';
  String convocationsSaved(int count) => count > 1
      ? 'Convoqués mis à jour sur $count séances'
      : 'Convoqués mis à jour';
  String get convocationsSaveFailed => 'Mise à jour impossible, réessaie';

  String get takeAttendance => 'Faire l\'appel';
  String get takeAttendanceTitle => 'Faire l\'appel';
  String get takeAttendanceSubtitle =>
      'Optionnel — pour les stats. Le RSVP avant la séance reste la priorité.';
  String get markAllPresent => 'Tous présents';
  String get attendancePresent => 'Présent';
  String get attendanceAbsent => 'Absent';
  String get attendanceSaved => 'Appel enregistré';
  String get attendanceSaveFailed => 'Enregistrement impossible, réessaie';
  String get attendanceUnmarked => 'Non pointé';

  String eventsCancelled(int count) =>
      count > 1 ? '$count événements annulés' : 'Événement annulé';
  String get eventCancelled => 'Événement annulé';

  String rdvPrefix(String time) => 'RDV $time';
  String get labelRdv => 'RDV';
  String get labelMatch => 'Match';
  String awayWithDate(String dateStr) => 'Extérieur · $dateStr';
  String matchAt(String time) => 'Match $time';
  String rdvAt(String time) => 'RDV $time';

  String nextEventWithTime(String typeLabel, String weekday, String time) =>
      'Prochain : $typeLabel $weekday $time';
  String nextEvent(String typeLabel, String weekday) =>
      'Prochain : $typeLabel $weekday';
  String lastEvent(String typeLabel, String relative) =>
      'Dernier : $typeLabel $relative';
  String get todayRelative => 'aujourd\'hui';
  String get yesterdayRelative => 'hier';
  String daysAgo(int days) => 'il y a ${days}j';
  String weeksAgo(int weeks) => 'il y a ${weeks}sem';
  String monthsAgo(int months) => 'il y a ${months}m';

  // Vues jour / semaine / mois (membres ; parent sans fiche : jour seul).
  String get viewModeDay => 'Jour';
  String get viewModeWeek => 'Semaine';
  String get viewModeMonth => 'Mois';
  String get previousWeekTooltip => 'Semaine précédente';
  String get nextWeekTooltip => 'Semaine suivante';
  String get previousMonthTooltip => 'Mois précédent';
  String get nextMonthTooltip => 'Mois suivant';

  /// Libellé lecteur d’écran d’une case de la grille mensuelle.
  String monthDayCellLabel(String dateLabel, int eventCount) =>
      switch (eventCount) {
        0 => '$dateLabel, rien de prévu',
        1 => '$dateLabel, 1 événement',
        _ => '$dateLabel, $eventCount événements',
      };
}
