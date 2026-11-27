import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';

/// Statistiques de présence basées sur les réponses RSVP des convoqués
/// (`teamMemberIds`, déjà nets des joueurs retirés). Pas de pointage terrain :
/// « présent » = a répondu « oui » ; une réponse corrigée par un coach compte
/// comme celle du joueur. Port fidèle de `attendanceStats.ts` (portail) :
/// mêmes règles, mêmes chiffres.

/// Compteurs de réponses (convocations = personnes × événements).
class RsvpCounts {
  const RsvpCounts({
    this.convoked = 0,
    this.yes = 0,
    this.maybe = 0,
    this.no = 0,
    this.none = 0,
  });

  final int convoked;
  final int yes;
  final int maybe;
  final int no;

  /// Sans réponse.
  final int none;

  static const RsvpCounts empty = RsvpCounts();

  /// Ajoute une convocation de réponse [answer].
  RsvpCounts add(RsvpStatus answer) => RsvpCounts(
    convoked: convoked + 1,
    yes: yes + (answer == RsvpStatus.yes ? 1 : 0),
    maybe: maybe + (answer == RsvpStatus.maybe ? 1 : 0),
    no: no + (answer == RsvpStatus.no ? 1 : 0),
    none: none + (answer == RsvpStatus.none ? 1 : 0),
  );

  /// Somme de deux compteurs.
  RsvpCounts operator +(RsvpCounts other) => RsvpCounts(
    convoked: convoked + other.convoked,
    yes: yes + other.yes,
    maybe: maybe + other.maybe,
    no: no + other.no,
    none: none + other.none,
  );
}

/// Part des convocations avec un « oui » (0–100), `null` sans convocation.
int? presenceRate(RsvpCounts counts) =>
    counts.convoked > 0 ? (counts.yes / counts.convoked * 100).round() : null;

/// Part des convocations avec une réponse (0–100), `null` sans convocation.
int? responseRate(RsvpCounts counts) => counts.convoked > 0
    ? ((counts.convoked - counts.none) / counts.convoked * 100).round()
    : null;

/// Compteurs de [event], éventuellement limités à [onlyMemberIds].
RsvpCounts eventCounts(ClubEvent event, [Set<String>? onlyMemberIds]) {
  var counts = RsvpCounts.empty;
  for (final memberId in event.teamMemberIds.toSet()) {
    if (onlyMemberIds != null && !onlyMemberIds.contains(memberId)) continue;
    counts = counts.add(event.rsvpStatusForUser(memberId));
  }
  return counts;
}

/// Début de [event] (jour + heure de début, ou le jour seul sans heure).
DateTime attendanceEventStart(ClubEvent event) =>
    combineEventDateTime(event.date, event.startTime) ??
    DateTime(event.date.year, event.date.month, event.date.day);

/// Événements d'équipe passés avec au moins un convoqué : débutés avant
/// [now], ou, sans heure de début, dont la journée est finie. Les événements
/// « tout le club » (AG, fête…) et annulés ne comptent pas.
List<ClubEvent> pastConvokedEvents(Iterable<ClubEvent> events, DateTime now) {
  return [
    for (final event in events)
      if (!event.canceled &&
          !event.allTeams &&
          event.teamMemberIds.isNotEmpty &&
          _hasStarted(event, now))
        event,
  ];
}

bool _hasStarted(ClubEvent event, DateTime now) {
  final start = combineEventDateTime(event.date, event.startTime);
  if (start != null) return start.isBefore(now);
  final nextDay = DateTime(
    event.date.year,
    event.date.month,
    event.date.day + 1,
  );
  return !nextDay.isAfter(now);
}

/// Bilan d'un membre (joueur ou coach) sur la période.
class MemberAttendance {
  const MemberAttendance({
    required this.memberId,
    required this.name,
    required this.counts,
  });

  final String memberId;
  final String name;
  final RsvpCounts counts;

  int? get rate => presenceRate(counts);

  /// Répond rarement : voir [isLowResponder].
  bool get isLowResponder => isLowResponderCounts(counts);
}

/// Bilan d'un événement (ligne de l'historique) : compteurs joueurs, plus
/// coachs de l'équipe convoqués / ayant répondu oui.
class EventAttendance {
  const EventAttendance({
    required this.event,
    required this.counts,
    required this.coachConvoked,
    required this.coachYes,
  });

  final ClubEvent event;
  final RsvpCounts counts;
  final int coachConvoked;
  final int coachYes;

  int? get rate => presenceRate(counts);
}

/// Bilan d'une équipe. Sans préfixe : joueurs seulement ; `all*` : joueurs
/// et coachs de l'équipe.
class TeamAttendance {
  const TeamAttendance({
    required this.team,
    required this.eventCount,
    required this.totals,
    required this.training,
    required this.match,
    required this.allTotals,
    required this.players,
    required this.coaches,
    required this.events,
  });

  final ClubTeam team;

  /// Événements analysés.
  final int eventCount;
  final RsvpCounts totals;

  /// Joueurs aux entraînements / aux matchs (tournois compris).
  final RsvpCounts training;
  final RsvpCounts match;
  final RsvpCounts allTotals;
  final List<MemberAttendance> players;
  final List<MemberAttendance> coaches;

  /// Du plus récent au plus ancien.
  final List<EventAttendance> events;

  int? get rate => presenceRate(totals);
  int? get responseRate => _responseRate(totals);
  int? get trainingRate => presenceRate(training);
  int? get matchRate => presenceRate(match);
  int? get allRate => presenceRate(allTotals);
  int? get allResponseRate => _responseRate(allTotals);

  /// Joueurs qui répondent rarement.
  List<MemberAttendance> get lowResponders => [
    for (final player in players)
      if (player.isLowResponder) player,
  ];
}

int? _responseRate(RsvpCounts counts) => responseRate(counts);

/// Seuil de non-réponse au-delà duquel un joueur est « à relancer » (%).
const int lowResponseThreshold = 50;

/// Minimum de convocations pour signaler un joueur (évite le bruit).
const int minConvocationsForAlert = 3;

/// Sans réponse plus d'une fois sur deux, à partir de
/// [minConvocationsForAlert] convocations.
bool isLowResponderCounts(RsvpCounts counts) =>
    counts.convoked >= minConvocationsForAlert &&
    counts.none / counts.convoked * 100 > lowResponseThreshold;

/// Bilan de [team] : événements passés de l'équipe, réponses de ses joueurs
/// et de ses coachs (rosters actuels). Un id présent dans les deux rosters
/// compte comme joueur. [names] : id de fiche → nom affiché.
TeamAttendance computeTeamAttendance({
  required ClubTeam team,
  required Iterable<ClubEvent> events,
  required Map<String, String> names,
  required DateTime now,
  String playerFallbackName = 'Joueur',
  String coachFallbackName = 'Coach',
}) {
  final roster = team.playerIds.toSet();
  final staff = {
    for (final id in team.coachIds)
      if (!roster.contains(id)) id,
  };
  var totals = RsvpCounts.empty;
  var coachTotals = RsvpCounts.empty;
  var training = RsvpCounts.empty;
  var match = RsvpCounts.empty;
  final byMember = <String, RsvpCounts>{};
  final rows = <EventAttendance>[];

  for (final event in pastConvokedEvents(events, now)) {
    if (!event.teamIds.contains(team.id)) continue;
    final counts = eventCounts(event, roster);
    final coachCounts = eventCounts(event, staff);
    if (counts.convoked == 0 && coachCounts.convoked == 0) continue;
    totals += counts;
    coachTotals += coachCounts;
    if (event.type == EventTypes.training) training += counts;
    if (event.type == EventTypes.match || event.type == EventTypes.tournament) {
      match += counts;
    }
    for (final memberId in event.teamMemberIds.toSet()) {
      if (!roster.contains(memberId) && !staff.contains(memberId)) continue;
      byMember[memberId] = (byMember[memberId] ?? RsvpCounts.empty).add(
        event.rsvpStatusForUser(memberId),
      );
    }
    rows.add(
      EventAttendance(
        event: event,
        counts: counts,
        coachConvoked: coachCounts.convoked,
        coachYes: coachCounts.yes,
      ),
    );
  }

  MemberAttendance memberRow(String memberId, String fallback) =>
      MemberAttendance(
        memberId: memberId,
        name: names[memberId] ?? fallback,
        counts: byMember[memberId] ?? RsvpCounts.empty,
      );

  rows.sort(
    (a, b) =>
        attendanceEventStart(b.event).compareTo(attendanceEventStart(a.event)),
  );
  return TeamAttendance(
    team: team,
    eventCount: rows.length,
    totals: totals,
    training: training,
    match: match,
    allTotals: totals + coachTotals,
    players: sortMembersByAttendance([
      for (final id in team.playerIds) memberRow(id, playerFallbackName),
    ]),
    coaches: sortMembersByAttendance([
      for (final id in staff) memberRow(id, coachFallbackName),
    ]),
    events: rows,
  );
}

/// Bilan personnel de [memberId] sur [team] pour la fiche membre.
///
/// Couvre joueur (sparring compris) et coach : équipe réduite au membre pour
/// que totaux, entraînements et matchs soient les siens. Un id présent dans
/// les deux rosters compte une seule fois (comme joueur). Retourne `null` s'il
/// n'est ni joueur ni coach, ou sans convocation sur la période de [events].
TeamAttendance? computeMemberTeamAttendance({
  required ClubTeam team,
  required String memberId,
  required Iterable<ClubEvent> events,
  required DateTime now,
}) {
  final isPlayer = team.playerIds.contains(memberId);
  final isCoach = team.coachIds.contains(memberId);
  if (!isPlayer && !isCoach) return null;

  // Coach seul : placé dans playerIds pour réutiliser le même affichage
  // (taux, entraînements, matchs) que pour un joueur.
  final row = computeTeamAttendance(
    team: ClubTeam(
      id: team.id,
      clubId: team.clubId,
      name: team.name,
      category: team.category,
      playerIds: [memberId],
      sparringIds: isPlayer && team.sparringIds.contains(memberId)
          ? [memberId]
          : const [],
    ),
    events: events,
    names: const {},
    now: now,
  );
  if (row.totals.convoked == 0) return null;
  return row;
}

/// Membres triés : sans convocation en dernier, puis présence croissante
/// (ceux qui décrochent en tête), puis nom.
List<MemberAttendance> sortMembersByAttendance(List<MemberAttendance> members) {
  return [...members]..sort((a, b) {
    final ra = a.rate;
    final rb = b.rate;
    if (ra == null && rb != null) return 1;
    if (ra != null && rb == null) return -1;
    if (ra != null && rb != null && ra != rb) return ra.compareTo(rb);
    return a.name.toLowerCase().compareTo(b.name.toLowerCase());
  });
}

/// Bilan global de plusieurs équipes.
class AttendanceSummary {
  const AttendanceSummary({
    required this.totals,
    required this.allTotals,
    required this.eventCount,
    required this.lowResponderIds,
  });

  final RsvpCounts totals;
  final RsvpCounts allTotals;
  final int eventCount;

  /// Joueurs « à relancer » (comptés une fois, toutes équipes confondues).
  final Set<String> lowResponderIds;

  int? get rate => presenceRate(totals);
  int? get responseRate => _responseRate(totals);
  int? get allRate => presenceRate(allTotals);
  int? get allResponseRate => _responseRate(allTotals);
}

/// Bilan global de [teams] : chaque convocation (événement × membre) et
/// chaque événement comptent une fois, même partagés par plusieurs équipes.
/// Joueurs seulement, et `all*` joueurs et coachs.
AttendanceSummary summarizeAttendance({
  required List<ClubTeam> teams,
  required Iterable<ClubEvent> events,
  required DateTime now,
}) {
  final teamIds = {for (final team in teams) team.id};
  final rosterOf = {for (final team in teams) team.id: team.playerIds.toSet()};
  final staffOf = {
    for (final team in teams)
      team.id: {
        for (final id in team.coachIds)
          if (!team.playerIds.contains(id)) id,
      },
  };
  var totals = RsvpCounts.empty;
  var allTotals = RsvpCounts.empty;
  var eventCount = 0;
  final byPlayer = <String, RsvpCounts>{};

  for (final event in pastConvokedEvents(events, now)) {
    final eventTeams = event.teamIds.where(teamIds.contains).toList();
    if (eventTeams.isEmpty) continue;
    final players = <String>{};
    final staff = <String>{};
    for (final teamId in eventTeams) {
      players.addAll(rosterOf[teamId] ?? const {});
      staff.addAll(staffOf[teamId] ?? const {});
    }
    staff.removeAll(players);
    final playerCounts = eventCounts(event, players);
    final staffCounts = eventCounts(event, staff);
    if (playerCounts.convoked == 0 && staffCounts.convoked == 0) continue;
    eventCount++;
    totals += playerCounts;
    allTotals += playerCounts + staffCounts;
    for (final memberId in event.teamMemberIds.toSet()) {
      if (!players.contains(memberId)) continue;
      byPlayer[memberId] = (byPlayer[memberId] ?? RsvpCounts.empty).add(
        event.rsvpStatusForUser(memberId),
      );
    }
  }
  return AttendanceSummary(
    totals: totals,
    allTotals: allTotals,
    eventCount: eventCount,
    lowResponderIds: {
      for (final entry in byPlayer.entries)
        if (isLowResponderCounts(entry.value)) entry.key,
    },
  );
}

/// Période d'analyse proposée.
enum AttendancePeriod { last30Days, last90Days, season }

/// Début de [period] : 30 / 90 jours calendaires avant [now], ou début de
/// saison (1er août précédent, saison sportive août → juillet).
DateTime attendancePeriodStart(AttendancePeriod period, DateTime now) {
  return switch (period) {
    AttendancePeriod.last30Days => DateTime(now.year, now.month, now.day - 30),
    AttendancePeriod.last90Days => DateTime(now.year, now.month, now.day - 90),
    AttendancePeriod.season => DateTime(
      now.month >= DateTime.august ? now.year : now.year - 1,
      DateTime.august,
    ),
  };
}
