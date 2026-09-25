import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/services/club_activity_service.dart';
import 'package:viro_team_v2/services/event/event_date_helpers.dart';
import 'package:viro_team_v2/services/event/event_day_queries.dart';
import 'package:viro_team_v2/services/event/event_mutations.dart';
import 'package:viro_team_v2/services/event/event_paths.dart';
import 'package:viro_team_v2/services/event/event_rsvp_operations.dart';
import 'package:viro_team_v2/services/event/event_upcoming_queries.dart';
import 'package:viro_team_v2/utils/firestore_instance.dart';

/// Façade événements club : planning, RSVP, création / annulation.
///
/// L'implémentation est découpée dans `lib/services/event/` ; l'API publique
/// reste stable pour les call sites (`eventServiceProvider`, `EventService()`).
class EventService {
  /// Crée le service événements (Firestore app + Functions europe-west1).
  EventService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
    ClubActivityService? activityService,
  })  : _db = firestore ?? appFirestore,
        _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'europe-west1'),
        _activity =
            activityService ?? ClubActivityService(firestore: firestore) {
    final paths = EventPaths(_db);
    _rsvp = EventRsvpOperations(paths: paths, functions: _functions);
    _upcoming = EventUpcomingQueries(
      paths: paths,
      watchClubMember: _rsvp.watchClubMember,
      rosterAudienceId: _rsvp.rosterAudienceId,
    );
    _day = EventDayQueries(paths: paths, upcoming: _upcoming);
    _mutations = EventMutations(paths: paths, activity: _activity);
  }

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;
  final ClubActivityService _activity;

  late final EventRsvpOperations _rsvp;
  late final EventUpcomingQueries _upcoming;
  late final EventDayQueries _day;
  late final EventMutations _mutations;

  /// Fenêtre « Planning à venir » : 14 jours calendaires à partir d'aujourd'hui.
  static const int upcomingPlanningHorizonDays =
      EventDateHelpers.upcomingPlanningHorizonDays;

  /// Même jour calendaire (fuseau local).
  static bool sameCalendarDay(DateTime a, DateTime b) =>
      EventDateHelpers.sameCalendarDay(a, b);

  /// Identifiant jour `yyyyMMdd` (local).
  static String dateIdFor(DateTime day) => EventDateHelpers.dateIdFor(day);

  /// Indique si [eventDate] est dans la fenêtre planning à venir.
  static bool isWithinUpcomingPlanningWindow(DateTime eventDate) =>
      EventDateHelpers.isWithinUpcomingPlanningWindow(eventDate);

  /// Comparaison chronologique (date croissante).
  static int compareByDate(ClubEvent a, ClubEvent b) =>
      EventDateHelpers.compareByDate(a, b);

  /// Copie triée par date croissante.
  static List<ClubEvent> sortedByDate(Iterable<ClubEvent> events) =>
      EventDateHelpers.sortedByDate(events);

  /// Événements à venir où [uid] (et optionnellement [alternateUid]) est convoqué.
  Stream<List<ClubEvent>> watchUpcomingEventsForClub({
    required String clubId,
    required String uid,
    String? alternateUid,
  }) =>
      _upcoming.watchUpcomingEventsForClub(
        clubId: clubId,
        uid: uid,
        alternateUid: alternateUid,
      );

  /// Événements des équipes où [authUid] est coach (hors convocation joueur).
  Stream<List<ClubEvent>> watchUpcomingEventsAsCoach({
    required String clubId,
    required String authUid,
  }) =>
      _upcoming.watchUpcomingEventsAsCoach(
        clubId: clubId,
        authUid: authUid,
      );

  /// Joueur convoqué + entraînements des équipes coachées.
  Stream<List<ClubEvent>> watchUpcomingEventsForClubMember({
    required String clubId,
    required String audienceId,
    required String authUid,
  }) =>
      _upcoming.watchUpcomingEventsForClubMember(
        clubId: clubId,
        audienceId: audienceId,
        authUid: authUid,
      );

  /// Événements des équipes du joueur (compat. v1 : `teamIds` / `teamName`).
  Stream<List<ClubEvent>> watchUpcomingEventsForPlayerTeams({
    required String clubId,
    required String audienceId,
    required String authUid,
  }) =>
      _upcoming.watchUpcomingEventsForPlayerTeams(
        clubId: clubId,
        audienceId: audienceId,
        authUid: authUid,
      );

  /// Événements à venir visibles par un parent (équipes de l'enfant).
  Stream<List<ClubEvent>> watchUpcomingEventsForGuardian({
    required String clubId,
    required List<String> childTeamIds,
  }) =>
      _upcoming.watchUpcomingEventsForGuardian(
        clubId: clubId,
        childTeamIds: childTeamIds,
      );

  /// Aperçu club côté parent : prochain à venir, sinon plus récent passé.
  Future<ClubEvent?> getHighlightEventForGuardian({
    required String clubId,
    required List<String> childTeamIds,
  }) =>
      _day.getHighlightEventForGuardian(
        clubId: clubId,
        childTeamIds: childTeamIds,
      );

  /// Convocation d’une fiche cible uniquement (pas de fusion coach / séniors).
  Stream<List<ClubEvent>> watchEventsForTargetMember({
    required String clubId,
    required String memberId,
  }) =>
      _upcoming.watchEventsForTargetMember(
        clubId: clubId,
        memberId: memberId,
      );

  /// Identifiant utilisé dans `teamMemberIds` / `rsvp` pour un membre du club.
  Future<String> resolveAudienceId({
    required String clubId,
    required String authUid,
  }) =>
      _rsvp.resolveAudienceId(clubId: clubId, authUid: authUid);

  /// Événements à venir pour un membre, tous ses clubs (spec home globale).
  Stream<List<ClubEvent>> watchUpcomingEventsForUser({
    required List<String> clubIds,
    required String authUid,
  }) =>
      _upcoming.watchUpcomingEventsForUser(
        clubIds: clubIds,
        authUid: authUid,
      );

  /// Tous les événements d'un jour (vue planning club).
  Stream<List<ClubEvent>> watchClubEventsOnDay({
    required String clubId,
    required DateTime day,
  }) =>
      _day.watchClubEventsOnDay(clubId: clubId, day: day);

  /// Événements d'un jour pour un membre (mêmes sources que l'accueil joueur).
  Stream<List<ClubEvent>> watchMemberEventsOnDay({
    required String clubId,
    required DateTime day,
    required String audienceId,
    required String authUid,
  }) =>
      _day.watchMemberEventsOnDay(
        clubId: clubId,
        day: day,
        audienceId: audienceId,
        authUid: authUid,
      );

  /// Première date d'événement du club (lecture globale : membres uniquement).
  ///
  /// Pour un parent sans fiche, utiliser [getFirstEventDateForTeams].
  Future<DateTime?> getFirstEventDate(String clubId) =>
      _day.getFirstEventDate(clubId);

  /// Première date d'événement parmi [teamIds] (chemin parent / rules).
  Future<DateTime?> getFirstEventDateForTeams({
    required String clubId,
    required List<String> teamIds,
  }) =>
      _day.getFirstEventDateForTeams(clubId: clubId, teamIds: teamIds);

  /// Crée un ou plusieurs événements (récurrence hebdomadaire pour entraînements).
  Future<int> createEvents({
    required String clubId,
    required String creatorId,
    required String type,
    required String title,
    required DateTime startDate,
    required List<String> teamIds,
    required List<String> teamMemberIds,
    required bool allTeams,
    String? location,
    String? startTime,
    String? endTime,
    String? meetingTime,
    String? meetingLocation,
    String? matchVenue,
    DateTime? recurrenceEndDate,
  }) =>
      _mutations.createEvents(
        clubId: clubId,
        creatorId: creatorId,
        type: type,
        title: title,
        startDate: startDate,
        teamIds: teamIds,
        teamMemberIds: teamMemberIds,
        allTeams: allTeams,
        location: location,
        startTime: startTime,
        endTime: endTime,
        meetingTime: meetingTime,
        meetingLocation: meetingLocation,
        matchVenue: matchVenue,
        recurrenceEndDate: recurrenceEndDate,
      );

  /// Annule un événement (marque `canceled`).
  Future<void> cancelEvent({
    required String clubId,
    required String eventId,
    String? title,
  }) =>
      _mutations.cancelEvent(
        clubId: clubId,
        eventId: eventId,
        title: title,
      );

  /// Annule tous les événements d'une série récurrente.
  Future<int> cancelEventSeries({
    required String clubId,
    required String seriesId,
    String? title,
  }) =>
      _mutations.cancelEventSeries(
        clubId: clubId,
        seriesId: seriesId,
        title: title,
      );

  /// Charge un événement par id (null si absent / annulé hors lecture).
  Future<ClubEvent?> getEvent({
    required String clubId,
    required String eventId,
  }) =>
      _day.getEvent(clubId: clubId, eventId: eventId);

  /// Enregistre le RSVP de [uid] (memberId cible : soi ou enfant).
  ///
  /// [viaCallable] : parent pour un enfant (rules : clé du connecté seulement).
  Future<void> updateRsvp({
    required String clubId,
    required String eventId,
    required String uid,
    required RsvpStatus status,
    bool viaCallable = false,
  }) =>
      _rsvp.updateRsvp(
        clubId: clubId,
        eventId: eventId,
        uid: uid,
        status: status,
        viaCallable: viaCallable,
      );

  /// Enregistre l'appel coach (`attendance`) sans modifier `rsvp`.
  Future<void> updateAttendance({
    required String clubId,
    required String eventId,
    required Map<String, AttendanceStatus> statusesByMemberId,
    required String markedByUid,
  }) =>
      _rsvp.updateAttendance(
        clubId: clubId,
        eventId: eventId,
        statusesByMemberId: statusesByMemberId,
        markedByUid: markedByUid,
      );

  /// Stream de la fiche membre liée à [uid].
  Stream<ClubMember?> watchClubMember({
    required String clubId,
    required String uid,
  }) =>
      _rsvp.watchClubMember(clubId: clubId, uid: uid);

  /// Prochain événement à venir, ou le plus récent passé (aperçu club).
  Future<ClubEvent?> getHighlightEventForClub(String clubId) =>
      _day.getHighlightEventForClub(clubId);

  /// Taux de réponses positives (RSVP yes) sur les 30 derniers jours.
  Future<double?> computeAttendanceRate({
    required String clubId,
    required String authUid,
  }) =>
      _rsvp.computeAttendanceRate(clubId: clubId, authUid: authUid);

  /// Taux de présence terrain (appel coach) sur 30 j.
  Future<double?> computePitchAttendanceRate({
    required String clubId,
  }) =>
      _rsvp.computePitchAttendanceRate(clubId: clubId);

  /// Ajoute un convoqué aux événements à venir d'une équipe.
  Future<void> addAudienceToUpcomingTeamEvents({
    required String clubId,
    required String teamId,
    required String audienceId,
  }) =>
      _rsvp.addAudienceToUpcomingTeamEvents(
        clubId: clubId,
        teamId: teamId,
        audienceId: audienceId,
      );

  /// Retire un convoqué des événements à venir (et clé RSVP orpheline).
  Future<void> removeAudienceFromUpcomingTeamEvents({
    required String clubId,
    required String teamId,
    required String audienceId,
  }) =>
      _rsvp.removeAudienceFromUpcomingTeamEvents(
        clubId: clubId,
        teamId: teamId,
        audienceId: audienceId,
      );
}
