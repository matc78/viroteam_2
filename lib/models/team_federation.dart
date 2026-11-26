import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';

int _int(Object? value) => value is num ? value.toInt() : 0;

String? _string(Object? value) =>
    value is String && value.trim().isNotEmpty ? value.trim() : null;

List<String> _strings(Object? value) =>
    (value as List<dynamic>?)?.whereType<String>().toList() ?? const [];

DateTime? _date(Object? value) => value is Timestamp ? value.toDate() : null;

/// Lien d'une équipe vers sa poule fédérale (`teams/{teamId}.federation`).
class TeamFederationLink {
  const TeamFederationLink({
    required this.provider,
    required this.teamKey,
    required this.teamName,
    this.url,
    this.season,
    this.pool,
    this.poolLabel,
    this.lastSyncAt,
    this.lastSyncFailed = false,
    this.excludedMemberIds = const [],
  });

  final String provider;

  /// Clé de l'équipe du club dans la poule (`usm-de-viroflay`).
  final String teamKey;

  /// Nom de l'équipe tel que publié par la fédération.
  final String teamName;
  final String? url;
  final String? season;
  final String? pool;
  final String? poolLabel;
  final DateTime? lastSyncAt;

  /// `true` si la dernière synchro a échoué (données précédentes conservées).
  final bool lastSyncFailed;

  /// Joueurs non convoqués par défaut sur les matchs créés par la synchro.
  final List<String> excludedMemberIds;

  /// Identifiant de la poule : l'URL canonique écrite par les Functions,
  /// sinon `fournisseur|saison|poule`. Deux équipes d'un club dans la même
  /// poule partagent cette clé.
  String get poolKey => url ?? '$provider|${season ?? ''}|${pool ?? teamKey}';

  /// Lit le champ `federation` d'une équipe ; `null` si absent ou incomplet.
  static TeamFederationLink? fromMap(Object? raw) {
    if (raw is! Map) return null;
    final provider = _string(raw[FirestoreFields.provider]);
    final teamKey = _string(raw[FirestoreFields.teamKey]);
    if (provider == null || teamKey == null) return null;
    return TeamFederationLink(
      provider: provider,
      teamKey: teamKey,
      teamName: _string(raw[FirestoreFields.teamName]) ?? teamKey,
      url: _string(raw[FirestoreFields.url]),
      season: _string(raw[FirestoreFields.season]),
      pool: _string(raw[FirestoreFields.pool]),
      poolLabel: _string(raw[FirestoreFields.poolLabel]),
      lastSyncAt: _date(raw[FirestoreFields.lastSyncAt]),
      lastSyncFailed: raw[FirestoreFields.lastSyncStatus] == 'error',
      excludedMemberIds: _strings(raw[FirestoreFields.excludedMemberIds]),
    );
  }
}

/// Score d'un match synchronisé, du point de vue de l'équipe du club.
class FederationMatchScore {
  const FederationMatchScore({
    required this.us,
    required this.them,
    this.sets = const [],
    this.forfeitByUs = false,
    this.forfeitByThem = false,
  });

  final int us;
  final int them;

  /// Sets « nous-eux » (`25-18`).
  final List<String> sets;
  final bool forfeitByUs;
  final bool forfeitByThem;

  bool get isWin => us > them;

  /// Lit `events/{id}.score` ; `null` si absent.
  static FederationMatchScore? fromMap(Object? raw) {
    if (raw is! Map) return null;
    final us = raw[FirestoreFields.scoreUs];
    final them = raw[FirestoreFields.scoreThem];
    if (us is! num || them is! num) return null;
    final forfeit = raw[FirestoreFields.forfeit];
    return FederationMatchScore(
      us: us.toInt(),
      them: them.toInt(),
      sets: _strings(raw[FirestoreFields.sets]),
      forfeitByUs: forfeit == 'us',
      forfeitByThem: forfeit == 'them',
    );
  }
}

/// Une ligne du classement d'une poule.
class PoolStandingRow {
  const PoolStandingRow({
    required this.key,
    required this.rank,
    required this.name,
    this.points = 0,
    this.played = 0,
    this.won = 0,
    this.lost = 0,
    this.forfeits = 0,
    this.wins30 = 0,
    this.wins31 = 0,
    this.wins32 = 0,
    this.losses23 = 0,
    this.losses13 = 0,
    this.losses03 = 0,
    this.setsFor = 0,
    this.setsAgainst = 0,
    this.pointsFor = 0,
    this.pointsAgainst = 0,
  });

  final String key;
  final int rank;
  final String name;
  final int points;
  final int played;
  final int won;
  final int lost;
  final int forfeits;
  final int wins30;
  final int wins31;
  final int wins32;
  final int losses23;
  final int losses13;
  final int losses03;
  final int setsFor;
  final int setsAgainst;
  final int pointsFor;
  final int pointsAgainst;

  /// Lit une ligne de `standings.rows`.
  factory PoolStandingRow.fromMap(Map<dynamic, dynamic> raw) => PoolStandingRow(
    key: _string(raw[FirestoreFields.key]) ?? '',
    rank: _int(raw[FirestoreFields.rank]),
    name: _string(raw[FirestoreFields.name]) ?? '',
    points: _int(raw[FirestoreFields.points]),
    played: _int(raw[FirestoreFields.played]),
    won: _int(raw[FirestoreFields.won]),
    lost: _int(raw[FirestoreFields.lost]),
    forfeits: _int(raw[FirestoreFields.forfeits]),
    wins30: _int(raw[FirestoreFields.wins30]),
    wins31: _int(raw[FirestoreFields.wins31]),
    wins32: _int(raw[FirestoreFields.wins32]),
    losses23: _int(raw[FirestoreFields.losses23]),
    losses13: _int(raw[FirestoreFields.losses13]),
    losses03: _int(raw[FirestoreFields.losses03]),
    setsFor: _int(raw[FirestoreFields.setsFor]),
    setsAgainst: _int(raw[FirestoreFields.setsAgainst]),
    pointsFor: _int(raw[FirestoreFields.pointsFor]),
    pointsAgainst: _int(raw[FirestoreFields.pointsAgainst]),
  );
}

/// Classement d'une poule (`teams/{teamId}/federation/standings`).
class PoolStandings {
  const PoolStandings({
    required this.rows,
    required this.myTeamKey,
    this.poolLabel,
    this.fetchedAt,
  });

  final List<PoolStandingRow> rows;

  /// Clé de l'équipe du club dans la poule.
  final String myTeamKey;
  final String? poolLabel;
  final DateTime? fetchedAt;

  /// Ligne de l'équipe [key], `null` si absente.
  PoolStandingRow? rowFor(String key) {
    for (final row in rows) {
      if (row.key == key) return row;
    }
    return null;
  }

  /// Lit le document `standings` ; `null` s'il n'existe pas.
  static PoolStandings? fromMap(Map<String, dynamic>? data) {
    if (data == null) return null;
    final rows =
        (data[FirestoreFields.rows] as List<dynamic>? ?? const [])
            .whereType<Map<dynamic, dynamic>>()
            .map(PoolStandingRow.fromMap)
            .where((row) => row.key.isNotEmpty)
            .toList()
          ..sort((a, b) => a.rank.compareTo(b.rank));
    return PoolStandings(
      rows: rows,
      myTeamKey: _string(data[FirestoreFields.teamKey]) ?? '',
      poolLabel: _string(data[FirestoreFields.poolLabel]),
      fetchedAt: _date(data[FirestoreFields.fetchedAt]),
    );
  }
}

/// Score publié d'un match de poule (recevant / visiteur).
class PoolMatchScore {
  const PoolMatchScore({
    required this.home,
    required this.away,
    this.sets = const [],
    this.forfeitByHome = false,
    this.forfeitByAway = false,
  });

  final int home;
  final int away;

  /// Sets « recevant-visiteur » (`25-18`).
  final List<String> sets;
  final bool forfeitByHome;
  final bool forfeitByAway;

  static PoolMatchScore? _fromMap(Object? raw) {
    if (raw is! Map) return null;
    final home = raw[FirestoreFields.home];
    final away = raw[FirestoreFields.away];
    if (home is! num || away is! num) return null;
    final forfeit = raw[FirestoreFields.forfeit];
    return PoolMatchScore(
      home: home.toInt(),
      away: away.toInt(),
      sets: _strings(raw[FirestoreFields.sets]),
      forfeitByHome: forfeit == 'home',
      forfeitByAway: forfeit == 'away',
    );
  }
}

/// Un match de la poule (`teams/{teamId}/federation/matches`).
class PoolMatch {
  const PoolMatch({
    required this.code,
    required this.round,
    required this.homeKey,
    required this.homeName,
    required this.awayKey,
    required this.awayName,
    this.date,
    this.time,
    this.venue,
    this.score,
  });

  final String code;
  final int round;

  /// Jour du match (heure locale à minuit), `null` si non programmé.
  final DateTime? date;

  /// `HH:mm`, `null` si non programmé.
  final String? time;
  final String homeKey;
  final String homeName;
  final String awayKey;
  final String awayName;
  final String? venue;
  final PoolMatchScore? score;

  bool get isPlayed => score != null;

  /// Lit un match de `matches.matches`.
  factory PoolMatch.fromMap(Map<dynamic, dynamic> raw) {
    final dateIso = _string(raw[FirestoreFields.date]);
    final parsed = dateIso == null ? null : DateTime.tryParse(dateIso);
    return PoolMatch(
      code: _string(raw[FirestoreFields.code]) ?? '',
      round: _int(raw[FirestoreFields.round]),
      date: parsed == null
          ? null
          : DateTime(parsed.year, parsed.month, parsed.day),
      time: _string(raw[FirestoreFields.time]),
      homeKey: _string(raw[FirestoreFields.homeKey]) ?? '',
      homeName: _string(raw[FirestoreFields.homeName]) ?? '',
      awayKey: _string(raw[FirestoreFields.awayKey]) ?? '',
      awayName: _string(raw[FirestoreFields.awayName]) ?? '',
      venue: _string(raw[FirestoreFields.venue]),
      score: PoolMatchScore._fromMap(raw[FirestoreFields.score]),
    );
  }

  /// Lit la liste `matches` du document `matches` (vide si absent).
  static List<PoolMatch> listFromMap(Map<String, dynamic>? data) =>
      (data?[FirestoreFields.matches] as List<dynamic>? ?? const [])
          .whereType<Map<dynamic, dynamic>>()
          .map(PoolMatch.fromMap)
          .where((match) => match.code.isNotEmpty)
          .toList();
}

/// Équipe de la poule proposée au coach lors de la liaison.
class FederationPoolTeam {
  const FederationPoolTeam({required this.key, required this.name});

  final String key;
  final String name;
}

/// Aperçu d'un lien de poule (avant liaison).
class FederationLinkPreview {
  const FederationLinkPreview({required this.poolLabel, required this.teams});

  final String poolLabel;
  final List<FederationPoolTeam> teams;
}
