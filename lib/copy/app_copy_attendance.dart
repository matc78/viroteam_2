part of 'app_copy.dart';

/// Textes des présences : page Présences du club (réponses des convoqués par
/// équipe et par joueur) et stats de saison sur la fiche d'un membre.
final class AppCopyAttendance {
  const AppCopyAttendance();

  // ——— Entrée club ———
  String get entryTitle => 'Présences';
  String get entrySubtitle => 'Qui répond présent, équipe par équipe';

  // ——— Page club ———
  String get title => 'Présences';
  String get intro =>
      'Réponses des convoqués aux événements passés. Une réponse corrigée par '
      'le coach compte comme celle du joueur.';
  String get period30Days => '30 jours';
  String get period90Days => '3 mois';
  String get periodSeason => 'Saison';
  String get statPlayersYes => 'Oui joueurs';
  String get statTeamYes => 'Oui équipe';
  String get statTeamYesHint => 'joueurs et coachs';
  String get statAnswered => 'Ont répondu';
  String get statEvents => 'Événements';
  String get statToRemind => 'À relancer';
  String get loadError => 'Impossible de charger les présences.';
  String get empty =>
      'Pas encore d’événement passé avec des convoqués sur la période.';
  String get noTeams => 'Aucune équipe à suivre pour l’instant.';
  String get toRemindFilterOn => 'Équipes avec des joueurs à relancer';
  String get showAllTeams => 'Voir toutes les équipes';
  String get playerFallback => 'Joueur';
  String get coachFallback => 'Coach';

  /// Pourcentage affiché (« — » sans convocation).
  String rate(int? value) => value == null ? '—' : '$value %';

  // ——— Ligne équipe ———
  String teamTrainingMatch(int? training, int? match) =>
      'Entraînements ${rate(training)} · Matchs ${rate(match)}';
  String teamMeta(int events, int? answered) =>
      '${eventsCount(events)} · ${rate(answered)} ont répondu';
  String eventsCount(int count) =>
      count > 1 ? '$count événements' : '$count événement';
  String toRemindBadge(int count) => '$count à relancer';
  String teamSemantics(String name, int? rate, int toRemind) =>
      '$name, ${this.rate(rate)} de oui'
      '${toRemind > 0 ? ', ${toRemindBadge(toRemind)}' : ''}, voir le détail';

  // ——— Détail équipe ———
  String get playersSection => 'Joueurs';
  String get coachesSection => 'Coachs';
  String get eventsSection => 'Derniers événements';
  String get lowResponder => 'Répond peu';
  String get noConvocation => 'Pas convoqué';
  String memberCounts(int yes, int maybe, int no, int none, int convoked) =>
      '$yes oui · $maybe p.-ê. · $no non · $none sans rép. · $convoked conv.';
  String eventCounts(int yes, int convoked, int coachYes, int coachConvoked) =>
      coachConvoked > 0
      ? '$yes/$convoked joueurs · $coachYes/$coachConvoked coachs'
      : '$yes/$convoked joueurs';
  String get teamNotFound => 'Équipe introuvable.';

  // ——— Fiche membre ———
  String get memberSection => 'Présences de la saison';
  String get memberEmpty =>
      'Pas encore de convocation passée cette saison '
      '(seuls les événements déjà commencés comptent).';
  String memberYes(int? value) => '${rate(value)} de oui';
  /// Oui / convocations (ex. « 4/10 »).
  String memberYesOf(int yes, int convocations) => '$yes/$convocations';
  /// Détail fiche : fractions oui/convocs (ex. « Entraînements 3/4 · Matchs 1/6 »).
  String memberTrainingMatch({
    required int trainingYes,
    required int trainingConvoked,
    required int matchYes,
    required int matchConvoked,
  }) =>
      'Entraînements ${memberYesOf(trainingYes, trainingConvoked)} · '
      'Matchs ${memberYesOf(matchYes, matchConvoked)}';
  String memberSemantics(
    String team,
    String roleLabels,
    int? value,
    int yes,
    int convocations,
  ) =>
      roleLabels.isEmpty
          ? '$team, ${memberYes(value)}, ${memberYesOf(yes, convocations)}'
          : '$team ($roleLabels), ${memberYes(value)}, '
              '${memberYesOf(yes, convocations)}';
}
