part of 'app_copy.dart';

/// Textes du lien fédération (FFVB), du classement et du parcours d'équipe.
final class AppCopyStandings {
  const AppCopyStandings();

  // ——— Lien fédération (carte équipe, onglet Gérer) ———
  String get linkAction => 'Lier le calendrier FFVB';
  String get linkActionHint => 'Matchs et classement importés tout seuls';

  /// Pastille d'en-tête d'une équipe liée à la fédération.
  String get federationBadge => 'FFVB';
  String get sheetTitle => 'Calendrier et classement FFVB';
  String get sheetHelper =>
      'Colle le lien de la page calendrier de ta poule sur le site FFVB '
      '(ffvbbeach.org). On importe les matchs dans le planning et on suit '
      'le classement tout seuls.';
  String get exampleCaption =>
      'C’est cette page-là : le calendrier de ta poule. Touche pour agrandir.';
  String get exampleImageLabel => 'Exemple de page calendrier de poule FFVB';
  String get urlLabel => 'Lien de la poule';
  String get urlHint => 'https://www.ffvbbeach.org/ffvbapp/resu/…';
  String get checkLink => 'Vérifier le lien';
  String get pickTeam => 'C’est laquelle, ton équipe ?';
  String get importAction => 'Importer les matchs';
  String get convocationStepTitle => 'Qui est convoqué ?';
  String get convocationStepHelper =>
      'Tout le monde est convoqué par défaut sur les matchs importés, et sur '
      'ceux que la FFVB ajoutera en cours de saison. Décoche ceux qui ne '
      'jouent pas ce championnat.';
  String get convocationStepLater =>
      'Tu pourras ajuster match par match plus tard depuis le planning.';
  String get invalidLink =>
      'Ce lien ne ressemble pas à une page de poule FFVB '
      '(vbspo_calendrier.php).';

  /// Callable absente / erreur technique : pas de blâme du site FFVB.
  String get linkCheckUnavailable =>
      'Impossible de vérifier le lien pour l’instant, réessaie dans un moment.';
  String get siteUnavailable =>
      'Le site FFVB ne répond pas, réessaie dans un moment.';
  String imported(int count) => count <= 1
      ? 'Calendrier lié, $count match importé'
      : 'Calendrier lié, $count matchs importés';
  String linkedSummary(String pool) => 'FFVB · $pool';
  String syncedAt(DateTime at, DateTime now) {
    final day = DateTime(at.year, at.month, at.day);
    final today = DateTime(now.year, now.month, now.day);
    final days = today.difference(day).inDays;
    if (days <= 0) {
      final hh = at.hour.toString().padLeft(2, '0');
      final mm = at.minute.toString().padLeft(2, '0');
      return 'synchro aujourd’hui à $hh:$mm';
    }
    if (days == 1) return 'synchro hier';
    return 'synchro il y a $days j';
  }

  String get syncPending => 'première synchro en cours';
  String get syncFailed =>
      'Dernière synchro ratée : on garde les données d’avant.';
  String get refresh => 'Actualiser';
  String get refreshing => 'Synchro FFVB en cours…';
  String refreshed(int changes) =>
      changes == 0 ? 'Déjà à jour' : 'À jour : $changes match(s) mis à jour';
  String get refreshTooSoon =>
      'Déjà actualisé il y a peu, réessaie dans quelques minutes.';
  String get unlink => 'Délier';
  String get unlinkTitle => 'Délier le calendrier FFVB ?';
  String get unlinkBody =>
      'Le classement disparaît de l’app et les matchs ne sont plus mis à '
      'jour.';
  String get deleteImportedMatches => 'Supprimer aussi les matchs importés';
  String get deleteImportedMatchesHint =>
      'Si le lien était le mauvais. Les matchs ajoutés à la main restent.';
  String get unlinked => 'Calendrier FFVB délié';
  String unlinkedWithMatches(int count) => count <= 1
      ? 'Calendrier FFVB délié, $count match supprimé'
      : 'Calendrier FFVB délié, $count matchs supprimés';
  String get actionFailed => 'Action impossible, réessaie';

  // ——— Classement ———
  String get screenTitle => 'Classement';
  String get openStandings => 'Classement';

  /// Position au classement : « 1er », « 2e »…
  String ordinal(int rank) => rank == 1 ? '1er' : '${rank}e';

  /// Puce de club des barres de choix (enfants suivis entre parenthèses).
  String clubChipSemantics(String club, List<String> children) =>
      children.isEmpty
      ? 'Classements de $club'
      : 'Classements de $club (${children.join(', ')})';

  /// Puce d'équipe des barres de choix, avec sa position si classée.
  String teamChipSemantics(String team, List<String> children, int? rank) {
    final who = children.isEmpty ? team : '$team (${children.join(', ')})';
    return rank == null ? who : '$who, ${ordinal(rank)}';
  }

  String get emptyTitle => 'Pas encore de classement';
  String get emptyBody =>
      'Le classement s’affiche dès la première synchro avec la fédé.';
  String get loadError => 'Impossible de charger le classement.';
  String updatedAt(DateTime at, DateTime now) =>
      'Mis à jour ${syncedAt(at, now).replaceFirst('synchro ', '')} · '
      'source FFVB';
  String get columnRank => '#';
  String get columnTeam => 'Équipe';
  String get columnPoints => 'Pts';
  String get columnPlayed => 'J';
  String get columnWon => 'G';
  String get columnLost => 'P';
  String standingSemantics({
    required int rank,
    required String name,
    required int points,
    required int played,
  }) => '$rank. $name, $points points, $played matchs joués';

  // ——— Parcours d'une équipe ———
  String get mySeasonTitle => 'Mon parcours';
  String get form => 'Forme';
  String get winShort => 'V';
  String get lossShort => 'D';
  String record({required int won, required int lost}) => '${won}V  ${lost}D';
  String get statRecord => 'Bilan';
  String get statSets => 'Sets';
  String get statPoints => 'Points';
  String breakdownCount(int count) => '×$count';
  String get venuesTitle => 'Salles';
  String get venuesEmpty => 'Salle pas encore connue';
  String get playedTitle => 'Parcours';
  String get upcomingTitle => 'À venir';
  String get noMatches => 'Aucun match pour l’instant.';
  String roundShort(int round) => 'J$round';
  String get homeLabel => 'Domicile';
  String get awayLabel => 'Extérieur';
  String get pointsUnit => 'pts';
  String playedCount(int played) =>
      '$played ${played > 1 ? 'matchs joués' : 'match joué'}';
  String sideRecord({required int won, required int lost}) =>
      '${won}V · ${lost}D';

  /// Libellé accessible d'un match du parcours (score ou heure en fin).
  String matchSemantics({
    required int round,
    required String opponent,
    required bool isHome,
    String? outcome,
  }) {
    final side = isHome ? homeLabel : awayLabel;
    final tail = outcome == null || outcome.isEmpty ? '' : ', $outcome';
    return 'Journée $round, $side ${versus(opponent)}$tail';
  }

  String versus(String opponent) => 'vs $opponent';
  String get forfeit => 'forfait';

  // ——— Planning (matchs synchronisés) ———
  String get federationEditHint =>
      'Match synchronisé avec la FFVB : date, heure et salle suivent la '
      'fédé et seront remises à jour à la prochaine synchro. Le RDV et les '
      'convocations restent à toi.';
  String matchHeadline(String typeLabel, String opponent) =>
      '$typeLabel ${versus(opponent)}';
  String scoreSuffix(int us, int them) => '$us-$them';
}
