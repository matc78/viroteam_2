import 'package:viro_team_v2/models/team_federation.dart';

const _lowercaseWords = {'de', 'du', 'des', 'le', 'la', 'les', 'et', 'en', 'sur'};

String _formatWord(String word, {required bool keepAcronym}) {
  if (word.isEmpty) return word;
  final lower = word.toLowerCase();
  if (_lowercaseWords.contains(lower)) return lower;
  // Sigles courts (USM, AS, ES, SP.) gardés en capitales, hors mots composés.
  final letters = word.replaceAll(RegExp(r'[^A-Za-zÀ-ÿ]'), '');
  if (keepAcronym &&
      letters.isNotEmpty &&
      letters.length <= 3 &&
      word == word.toUpperCase()) {
    return word;
  }
  final apostrophe = lower.indexOf('\'');
  if (apostrophe == 1) {
    // D'ARCY → d'Arcy
    return '${lower.substring(0, 2)}${_capitalize(lower.substring(2))}';
  }
  return _capitalize(lower);
}

String _capitalize(String word) =>
    word.isEmpty ? word : '${word[0].toUpperCase()}${word.substring(1)}';

/// Nom d'équipe FFVB (en capitales) lisible : `USM DE VIROFLAY` →
/// `USM de Viroflay`, `MARLY-LE-ROI VOLLEY-BALL` → `Marly-le-Roi Volley-Ball`.
String displayPoolTeamName(String raw) {
  final words = raw.trim().split(RegExp(r'\s+'));
  final formatted = <String>[];
  for (var i = 0; i < words.length; i++) {
    final parts = words[i].split('-');
    final keepAcronym = parts.length == 1;
    final formattedParts = parts
        .map((part) => _formatWord(part, keepAcronym: keepAcronym))
        .toList();
    var word = formattedParts.join('-');
    if (i == 0) word = _capitalize(word);
    formatted.add(word);
  }
  return formatted.join(' ');
}

/// Un match du parcours d'une équipe, de son point de vue.
class PoolTeamMatch {
  const PoolTeamMatch({
    required this.code,
    required this.round,
    required this.isHome,
    required this.opponentKey,
    required this.opponentName,
    this.date,
    this.time,
    this.venue,
    this.us,
    this.them,
    this.sets = const [],
    this.forfeit = false,
  });

  final String code;
  final int round;
  final DateTime? date;
  final String? time;
  final bool isHome;
  final String opponentKey;
  final String opponentName;
  final String? venue;

  /// Sets gagnés par l'équipe, `null` si le match n'est pas joué.
  final int? us;
  final int? them;

  /// Sets « équipe-adversaire » (`25-18`).
  final List<String> sets;

  /// Match décidé par forfait (d'un côté ou de l'autre).
  final bool forfeit;

  bool get isPlayed => us != null && them != null;
  bool get isWin => isPlayed && us! > them!;
}

/// Saison d'une équipe de la poule : classement, forme, bilans, salles et
/// parcours (matchs joués puis à venir).
class PoolTeamSeason {
  const PoolTeamSeason({
    required this.key,
    required this.name,
    required this.isMyTeam,
    required this.row,
    required this.form,
    required this.homeWon,
    required this.homeLost,
    required this.awayWon,
    required this.awayLost,
    required this.homeVenues,
    required this.played,
    required this.upcoming,
  });

  final String key;
  final String name;
  final bool isMyTeam;

  /// Ligne du classement (`null` si l'équipe n'y figure pas encore).
  final PoolStandingRow? row;

  /// 5 derniers résultats, du plus ancien au plus récent (`true` = victoire).
  final List<bool> form;
  final int homeWon;
  final int homeLost;
  final int awayWon;
  final int awayLost;

  /// Salles où l'équipe reçoit, sans doublon, dans l'ordre d'apparition.
  final List<String> homeVenues;

  /// Matchs joués, du plus récent au plus ancien.
  final List<PoolTeamMatch> played;

  /// Matchs à venir, du plus proche au plus lointain.
  final List<PoolTeamMatch> upcoming;
}

const _formLength = 5;

int _compareMatches(PoolMatch a, PoolMatch b) {
  final dateA = a.date;
  final dateB = b.date;
  if (dateA != null && dateB != null) {
    final byDate = dateA.compareTo(dateB);
    if (byDate != 0) return byDate;
    return (a.time ?? '').compareTo(b.time ?? '');
  }
  if (dateA == null && dateB != null) return 1;
  if (dateA != null && dateB == null) return -1;
  return a.round.compareTo(b.round);
}

PoolTeamMatch _teamMatch(PoolMatch match, String teamKey) {
  final isHome = match.homeKey == teamKey;
  final score = match.score;
  return PoolTeamMatch(
    code: match.code,
    round: match.round,
    date: match.date,
    time: match.time,
    isHome: isHome,
    opponentKey: isHome ? match.awayKey : match.homeKey,
    opponentName: isHome ? match.awayName : match.homeName,
    venue: match.venue,
    us: score == null ? null : (isHome ? score.home : score.away),
    them: score == null ? null : (isHome ? score.away : score.home),
    sets:
        score?.sets.map((set) {
          if (isHome) return set;
          final parts = set.split('-');
          return parts.length == 2 ? '${parts[1]}-${parts[0]}' : set;
        }).toList() ??
        const [],
    forfeit: score != null && (score.forfeitByHome || score.forfeitByAway),
  );
}

/// Calcule la saison de l'équipe [teamKey] à partir du classement et des
/// matchs de la poule. `null` si l'équipe n'apparaît nulle part.
PoolTeamSeason? buildPoolTeamSeason({
  required PoolStandings? standings,
  required List<PoolMatch> matches,
  required String teamKey,
}) {
  final row = standings?.rowFor(teamKey);
  final teamMatches =
      matches
          .where((m) => m.homeKey == teamKey || m.awayKey == teamKey)
          .toList()
        ..sort(_compareMatches);
  if (row == null && teamMatches.isEmpty) return null;

  final views = teamMatches.map((m) => _teamMatch(m, teamKey)).toList();
  // Chronologique pour forme / bilans ; affichage du parcours en sens inverse.
  final playedChronological = views.where((m) => m.isPlayed).toList();
  final upcoming = views.where((m) => !m.isPlayed).toList();
  final played = playedChronological.reversed.toList();

  var homeWon = 0, homeLost = 0, awayWon = 0, awayLost = 0;
  for (final match in playedChronological) {
    if (match.isHome) {
      match.isWin ? homeWon++ : homeLost++;
    } else {
      match.isWin ? awayWon++ : awayLost++;
    }
  }

  final homeVenues = <String>[];
  for (final match in views) {
    final venue = match.venue;
    if (match.isHome && venue != null && !homeVenues.contains(venue)) {
      homeVenues.add(venue);
    }
  }

  final rawName =
      row?.name ??
      (teamMatches.first.homeKey == teamKey
          ? teamMatches.first.homeName
          : teamMatches.first.awayName);

  return PoolTeamSeason(
    key: teamKey,
    name: rawName,
    isMyTeam: standings?.myTeamKey == teamKey,
    row: row,
    form: playedChronological
        .skip(
          playedChronological.length > _formLength
              ? playedChronological.length - _formLength
              : 0,
        )
        .map((m) => m.isWin)
        .toList(),
    homeWon: homeWon,
    homeLost: homeLost,
    awayWon: awayWon,
    awayLost: awayLost,
    homeVenues: homeVenues,
    played: played,
    upcoming: upcoming,
  );
}
