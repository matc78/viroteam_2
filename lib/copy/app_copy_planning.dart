part of 'app_copy.dart';

/// Planning club / membre, événements, RSVP.
final class AppCopyPlanning {
  const AppCopyPlanning();

  String get screenTitle => 'Planning';
  String get emptyDayAdmin =>
      'Rien de prévu ce jour-là.\nTape sur + pour poser un événement.';
  String get emptyDay => 'Rien de prévu ce jour-là.';
  String get emptyMember14d =>
      'Terrain libre sur les 14 prochains jours — profite-en.';
  String get noMembersCalled => 'Personne de convoqué pour l’instant';
  String get notRegisteredYet => 'Pas encore inscrit';
  String get addToCalendarTooltip =>
      'Ajouter le calendrier dynamique à mon agenda';
  String get noUpcomingClub => 'Rien à venir au planning';
  String get noUpcomingForSheet =>
      'Rien à venir pour cette fiche.';

  String get next14DaysTitle => '14 prochains jours';
  String get loadClubsError => 'Impossible de charger tes clubs';
  String get loadPlanningError => 'Impossible de charger le planning';
  String get rsvpFailed => 'RSVP impossible, réessaie';

  String get clubFallbackName => 'Club';
  String get allClub => 'Tout le club';
  String get unnamedMember => 'Sans nom';

  String get typeTraining => 'Entraînement';
  String get typeMatch => 'Match';
  String get typeTournament => 'Tournoi';
  String get typeOther => 'Autre';
  String get typeEvent => 'Événement';

  String eventType(String type) => switch (type) {
        'training' => typeTraining,
        'match' => typeMatch,
        'tournament' => typeTournament,
        _ => typeEvent,
      };

  String get rsvpPresent => 'Présent';
  String get rsvpAbsent => 'Absent';
  String get rsvpPending => 'En attente';

  String get newEventTitle => 'Nouvel événement';
  String get reservedToCoachesAdmins =>
      'Réservé aux coachs et admins';
  String get fieldType => 'Type';
  String get fieldTeam => 'Équipe';
  String get chooseTeam => 'Choisir une équipe';
  String get fieldTitle => 'Titre';
  String get titleHint => 'Réunion, stage…';
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
}
