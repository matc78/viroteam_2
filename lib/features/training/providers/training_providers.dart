import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/event/event_date_helpers.dart';
import 'package:viro_team_v2/services/training/training_feedback_inbox.dart';
import 'package:viro_team_v2/services/training/training_library.dart';
import 'package:viro_team_v2/utils/calendar_days.dart';

/// Entraînement d'un club.
typedef TrainingEventRef = ({String clubId, String eventId});

/// Partie d'un coach sur un entraînement.
typedef TrainingCoachRef = ({String clubId, String eventId, String coachUid});

/// Retours reçus par une fiche membre (soi ou enfant) sur un entraînement.
typedef TrainingMemberRef = ({String clubId, String eventId, String memberId});

/// Liste paginée des entraînements passés d'un club.
typedef PastTrainingsRef = ({String clubId, int limit});

/// Taille d'une page de la liste des entraînements passés.
const int pastTrainingsPageSize = 20;

/// Fenêtre du compteur « à faire » de la tuile d'accueil (jours).
const int pendingTrainingFeedbackWindowDays = 15;

/// Uid du compte connecté (`null` hors session), une fois le jeton reçu par
/// Firestore ([firestoreAuthReadyProvider], comme les autres flux) : pas
/// `authUidProvider`, qui peut émettre avant et faire échouer les listeners.
final trainingAuthUidProvider = Provider<String?>(
  (ref) => ref.watch(firestoreAuthReadyProvider).value?.uid,
);

/// Entraînement en direct (statut d'envoi, convoqués).
final trainingEventProvider = StreamProvider.autoDispose
    .family<ClubEvent?, TrainingEventRef>((ref, target) {
      if (ref.watch(trainingAuthUidProvider) == null) {
        return Stream.value(null);
      }
      return ref
          .watch(trainingFeedbackServiceProvider)
          .watchEvent(clubId: target.clubId, eventId: target.eventId);
    });

/// Retours envoyés sur l'entraînement (un par coach).
final trainingFeedbacksProvider = StreamProvider.autoDispose
    .family<List<TrainingFeedback>, TrainingEventRef>((ref, target) {
      if (ref.watch(trainingAuthUidProvider) == null) {
        return Stream.value(const []);
      }
      return ref
          .watch(trainingFeedbackServiceProvider)
          .watchFeedbacks(clubId: target.clubId, eventId: target.eventId);
    });

/// Messages perso envoyés par un coach (coachs de la séance et admin).
final trainingCoachMessagesProvider = StreamProvider.autoDispose
    .family<List<TrainingPlayerMessage>, TrainingCoachRef>((ref, target) {
      return ref
          .watch(trainingFeedbackServiceProvider)
          .watchCoachMessages(
            clubId: target.clubId,
            eventId: target.eventId,
            coachUid: target.coachUid,
          );
    });

/// Retour reçu par un joueur (ou son parent) : retours collectifs et
/// messages perso qui lui sont adressés.
typedef TrainingReceived = ({
  List<TrainingFeedback> feedbacks,
  List<TrainingPlayerMessage> messages,
});

/// Messages perso adressés à [TrainingMemberRef.memberId], un par coach ayant
/// envoyé son retour.
final trainingMemberMessagesProvider = StreamProvider.autoDispose
    .family<List<TrainingPlayerMessage>, TrainingMemberRef>((ref, target) {
      final feedbacks =
          ref
              .watch(
                trainingFeedbacksProvider((
                  clubId: target.clubId,
                  eventId: target.eventId,
                )),
              )
              .value ??
          const <TrainingFeedback>[];
      return ref
          .watch(trainingFeedbackServiceProvider)
          .watchMessagesForMember(
            clubId: target.clubId,
            eventId: target.eventId,
            coachUids: [for (final f in feedbacks) f.coachUid],
            memberId: target.memberId,
          );
    });

/// Retours collectifs + messages perso de [TrainingMemberRef.memberId].
final trainingReceivedProvider = Provider.autoDispose
    .family<TrainingReceived, TrainingMemberRef>((ref, target) {
      final feedbacks =
          ref
              .watch(
                trainingFeedbacksProvider((
                  clubId: target.clubId,
                  eventId: target.eventId,
                )),
              )
              .value ??
          const <TrainingFeedback>[];
      final messages =
          ref.watch(trainingMemberMessagesProvider(target)).value ??
          const <TrainingPlayerMessage>[];
      return (feedbacks: feedbacks, messages: messages);
    });

/// Entraînements passés des équipes que j'entraîne dans le club, du plus
/// récent au plus ancien.
final pastTrainingsProvider = StreamProvider.autoDispose
    .family<List<ClubEvent>, PastTrainingsRef>((ref, target) {
      final teamIds = ref.watch(clubAccessProvider(target.clubId)).coachTeamIds;
      if (ref.watch(trainingAuthUidProvider) == null || teamIds.isEmpty) {
        return Stream.value(const []);
      }
      return ref
          .watch(trainingFeedbackServiceProvider)
          .watchPastTrainings(
            clubId: target.clubId,
            teamIds: teamIds,
            limit: target.limit,
          );
    });

/// Début de la fenêtre des rappels d'accueil (coach et joueur).
DateTime _feedbackWindowStart() => addCalendarDays(
  EventDateHelpers.startOfToday(),
  -pendingTrainingFeedbackWindowDays,
);

/// Mes états perso sur les entraînements du club (flemme, retours lus),
/// indexés par id d'événement.
final trainingFeedbackUserStatesProvider = StreamProvider.autoDispose
    .family<Map<String, TrainingFeedbackUserState>, String>((ref, clubId) {
      final uid = ref.watch(trainingAuthUidProvider);
      if (uid == null) return Stream.value(const {});
      return ref
          .watch(trainingFeedbackServiceProvider)
          .watchUserStates(uid: uid, clubId: clubId);
    });

/// Entraînements des [pendingTrainingFeedbackWindowDays] derniers jours dont
/// mon retour reste à faire, hors « flemme » (compteur de la tuile d'accueil).
final pendingTrainingFeedbackCountProvider = Provider.autoDispose
    .family<int, String>((ref, clubId) {
      final uid = ref.watch(trainingAuthUidProvider);
      if (uid == null) return 0;
      final trainings =
          ref
              .watch(
                pastTrainingsProvider((
                  clubId: clubId,
                  limit: pastTrainingsPageSize,
                )),
              )
              .value ??
          const <ClubEvent>[];
      final states =
          ref.watch(trainingFeedbackUserStatesProvider(clubId)).value ??
          const {};
      return countPendingCoachFeedback(
        events: trainings,
        uid: uid,
        states: states,
        since: _feedbackWindowStart(),
      );
    });

/// Lignes de la liste « Feedback entraînement » : mes entraînements passés
/// (statut À faire / Envoyé / Flemme), chacun suivi des retours envoyés par
/// les autres coachs.
final trainingFeedbackListRowsProvider = Provider.autoDispose
    .family<AsyncValue<List<TrainingFeedbackListRow>>, PastTrainingsRef>((
      ref,
      target,
    ) {
      final uid = ref.watch(trainingAuthUidProvider) ?? '';
      final states =
          ref.watch(trainingFeedbackUserStatesProvider(target.clubId)).value ??
          const {};
      return ref
          .watch(pastTrainingsProvider(target))
          .whenData(
            (events) => buildCoachFeedbackRows(
              events: events,
              uid: uid,
              states: states,
            ),
          );
    });

/// Fiches pour qui je lis les retours dans le club : la mienne (équipes où
/// je joue, hors celles que j'entraîne) et celles de mes enfants.
final trainingFeedbackReadersProvider = FutureProvider.autoDispose
    .family<List<TrainingFeedbackReader>, String>((ref, clubId) async {
      final user = ref.watch(viroUserProvider).value;
      if (user == null) return const [];
      final coachTeamIds = ref
          .watch(clubAccessProvider(clubId))
          .coachTeamIds
          .toSet();
      final self = user.isLicensedInClub(clubId)
          ? ref.watch(clubMemberProvider(clubId)).value
          : null;
      final childLinks = user.activeParentLinksInClub(clubId);
      final guardianService = ref.read(guardianServiceProvider);

      final readers = <TrainingFeedbackReader>[
        if (self != null)
          (
            memberId: self.memberId,
            teamIds: [
              for (final teamId in self.teamIds)
                if (!coachTeamIds.contains(teamId)) teamId,
            ],
            childFirstName: null,
          ),
      ];
      for (final link in childLinks) {
        final child = await guardianService.getClubMember(
          clubId: clubId,
          memberId: link.memberId,
        );
        if (child == null) continue;
        readers.add((
          memberId: child.memberId,
          teamIds: child.teamIds,
          childFirstName: child.preferredFirstName,
        ));
      }
      return [
        for (final reader in readers)
          if (reader.teamIds.isNotEmpty) reader,
      ];
    });

/// Entraînements passés des équipes de mes lecteurs (moi, mes enfants).
final receivedTrainingsProvider = StreamProvider.autoDispose
    .family<List<ClubEvent>, String>((ref, clubId) {
      final readers =
          ref.watch(trainingFeedbackReadersProvider(clubId)).value ?? const [];
      final teamIds = {for (final reader in readers) ...reader.teamIds}.toList()
        ..sort();
      if (ref.watch(trainingAuthUidProvider) == null || teamIds.isEmpty) {
        return Stream.value(const []);
      }
      return ref
          .watch(trainingFeedbackServiceProvider)
          .watchPastTrainings(
            clubId: clubId,
            teamIds: teamIds,
            limit: pastTrainingsPageSize,
          );
    });

/// Retours de coach reçus dans le club (moi ou mes enfants), lus ou non, du
/// plus récent au plus ancien.
final receivedTrainingFeedbackProvider = Provider.autoDispose
    .family<List<TrainingFeedbackInboxItem>, String>((ref, clubId) {
      final uid = ref.watch(trainingAuthUidProvider);
      if (uid == null) return const [];
      final readers =
          ref.watch(trainingFeedbackReadersProvider(clubId)).value ?? const [];
      if (readers.isEmpty) return const [];
      final states = ref
          .watch(trainingFeedbackUserStatesProvider(clubId))
          .value;
      // États pas encore chargés : rien plutôt qu'un faux « non lu ».
      if (states == null) return const [];
      return buildReceivedTrainingFeedback(
        events: ref.watch(receivedTrainingsProvider(clubId)).value ?? const [],
        readers: readers,
        states: states,
        uid: uid,
      );
    });

/// Entraînements passés des équipes du club avec des retours envoyés, que je
/// n'entraîne pas : consultation pour un admin (vide sinon).
final adminReviewRowsProvider = StreamProvider.autoDispose
    .family<List<TrainingFeedbackReviewRow>, String>((ref, clubId) {
      final access = ref.watch(clubAccessProvider(clubId));
      final teams = ref.watch(clubTeamsProvider(clubId)).value ?? const [];
      final coachTeamIds = access.coachTeamIds.toSet();
      final teamIds = [
        for (final team in teams)
          if (!coachTeamIds.contains(team.id)) team.id,
      ]..sort();
      if (!access.isAdmin ||
          ref.watch(trainingAuthUidProvider) == null ||
          teamIds.isEmpty) {
        return Stream.value(const []);
      }
      return ref
          .watch(trainingFeedbackServiceProvider)
          .watchPastTrainings(
            clubId: clubId,
            teamIds: teamIds,
            limit: pastTrainingsPageSize,
          )
          .map(
            (events) => buildAdminReviewRows(
              events: events,
              coachTeamIds: coachTeamIds,
            ),
          );
    });

/// Partie affichée de la page Feedback (`?tab=` de la route).
enum TrainingFeedbackHubTab { manage, mine }

/// Clubs de la page Feedback, partagés entre l'en-tête et la page.
typedef TrainingFeedbackHubClub = ({
  String clubId,
  String clubName,
  bool canManage,
});

/// Clubs où le compte gère des retours (coach d'une équipe ou admin) ou
/// peut en recevoir (joueur, parent) — page Feedback et bouton d'en-tête.
final trainingFeedbackHubClubsProvider =
    Provider.autoDispose<List<TrainingFeedbackHubClub>>((ref) {
      final clubs = ref.watch(userClubsProvider).value ?? const [];
      return [
        for (final entry in clubs)
          (
            clubId: entry.club.id,
            clubName: entry.club.name,
            canManage:
                entry.isLicensed &&
                (ref.watch(clubAccessProvider(entry.club.id)).isTeamCoach ||
                    ref.watch(clubAccessProvider(entry.club.id)).isAdmin),
          ),
      ];
    });

/// La page Feedback a une partie « Gestion » (coach ou admin quelque part).
final trainingFeedbackCanManageProvider = Provider.autoDispose<bool>(
  (ref) =>
      ref.watch(trainingFeedbackHubClubsProvider).any((club) => club.canManage),
);

/// La page Feedback a une partie « Pour moi » (je joue, ou un enfant joue,
/// dans une équipe).
final trainingFeedbackCanReceiveProvider = Provider.autoDispose<bool>(
  (ref) => ref
      .watch(trainingFeedbackHubClubsProvider)
      .any(
        (club) =>
            (ref.watch(trainingFeedbackReadersProvider(club.clubId)).value ??
                    const [])
                .isNotEmpty,
      ),
);

/// Retours reçus, tous clubs confondus, du plus récent au plus ancien.
final allReceivedTrainingFeedbackProvider =
    Provider.autoDispose<List<TrainingFeedbackInboxItem>>((ref) {
      final items = [
        for (final club in ref.watch(trainingFeedbackHubClubsProvider))
          ...ref.watch(receivedTrainingFeedbackProvider(club.clubId)),
      ]..sort((a, b) => b.event.date.compareTo(a.event.date));
      return items;
    });

/// Nombre de retours non lus, tous clubs confondus (pastille d'en-tête).
final unseenTrainingFeedbackCountProvider = Provider.autoDispose<int>(
  (ref) => ref
      .watch(allReceivedTrainingFeedbackProvider)
      .where((item) => item.isUnseen)
      .length,
);

/// Retours à faire, tous clubs confondus (pastille « Gestion »).
final pendingTrainingFeedbackTotalProvider = Provider.autoDispose<int>(
  (ref) => [
    for (final club in ref.watch(trainingFeedbackHubClubsProvider))
      if (club.canManage)
        ref.watch(pendingTrainingFeedbackCountProvider(club.clubId)),
  ].fold(0, (sum, count) => sum + count),
);

/// Élément de la partie « Gestion » de la page Feedback.
sealed class TrainingFeedbackManageEntry {
  const TrainingFeedbackManageEntry(this.clubId);

  final String clubId;
}

/// Intertitre : nom du club ([clubName], plusieurs clubs gérés) ou, si
/// `null`, « Autres équipes du club » (consultation admin).
final class TrainingFeedbackManageHeader extends TrainingFeedbackManageEntry {
  const TrainingFeedbackManageHeader(super.clubId, {this.clubName});

  final String? clubName;
}

/// Ligne d'entraînement (mon retour, collègue ou consultation admin).
final class TrainingFeedbackManageRowEntry extends TrainingFeedbackManageEntry {
  const TrainingFeedbackManageRowEntry(super.clubId, this.row);

  final TrainingFeedbackListRow row;
}

/// Lien vers la liste complète des entraînements du club.
final class TrainingFeedbackManageSeeAll extends TrainingFeedbackManageEntry {
  const TrainingFeedbackManageSeeAll(super.clubId);
}

/// Partie « Gestion » : pour chaque club géré, mes entraînements passés
/// (avec les retours des collègues), puis les autres équipes pour un admin.
final trainingFeedbackManageEntriesProvider =
    Provider.autoDispose<List<TrainingFeedbackManageEntry>>((ref) {
      final clubs = [
        for (final club in ref.watch(trainingFeedbackHubClubsProvider))
          if (club.canManage) club,
      ];
      final entries = <TrainingFeedbackManageEntry>[];
      for (final club in clubs) {
        final pastRef = (clubId: club.clubId, limit: pastTrainingsPageSize);
        final coachRows =
            ref.watch(trainingFeedbackListRowsProvider(pastRef)).value ??
            const <TrainingFeedbackListRow>[];
        final eventCount =
            ref.watch(pastTrainingsProvider(pastRef)).value?.length ?? 0;
        final reviewRows =
            ref.watch(adminReviewRowsProvider(club.clubId)).value ?? const [];
        if (coachRows.isEmpty && reviewRows.isEmpty) continue;
        if (clubs.length > 1) {
          entries.add(
            TrainingFeedbackManageHeader(club.clubId, clubName: club.clubName),
          );
        }
        for (final row in coachRows) {
          entries.add(TrainingFeedbackManageRowEntry(club.clubId, row));
        }
        if (eventCount >= pastTrainingsPageSize) {
          entries.add(TrainingFeedbackManageSeeAll(club.clubId));
        }
        if (reviewRows.isNotEmpty) {
          if (coachRows.isNotEmpty) {
            entries.add(TrainingFeedbackManageHeader(club.clubId));
          }
          for (final row in reviewRows) {
            entries.add(TrainingFeedbackManageRowEntry(club.clubId, row));
          }
        }
      }
      return entries;
    });

/// Brouillon de retour du coach connecté (lu une fois à l'ouverture).
final trainingFeedbackDraftProvider = FutureProvider.autoDispose
    .family<TrainingFeedbackDraft?, TrainingCoachRef>((ref, target) {
      return ref
          .watch(trainingFeedbackServiceProvider)
          .getDraft(
            clubId: target.clubId,
            eventId: target.eventId,
            coachUid: target.coachUid,
          );
    });

/// Point de départ du retour d'un coach : son brouillon, sinon son retour
/// déjà envoyé, sinon vide (`null` pendant le chargement).
final trainingFeedbackInitialDraftProvider = Provider.autoDispose
    .family<TrainingFeedbackDraft?, TrainingCoachRef>((ref, target) {
      final draftAsync = ref.watch(trainingFeedbackDraftProvider(target));
      final feedbacksAsync = ref.watch(
        trainingFeedbacksProvider((
          clubId: target.clubId,
          eventId: target.eventId,
        )),
      );
      final messagesAsync = ref.watch(trainingCoachMessagesProvider(target));
      if (draftAsync.isLoading ||
          feedbacksAsync.isLoading ||
          messagesAsync.isLoading) {
        return null;
      }
      final draft = draftAsync.value;
      if (draft != null) return draft;
      final sent = feedbacksAsync.value
          ?.where((feedback) => feedback.coachUid == target.coachUid)
          .firstOrNull;
      if (sent == null) return TrainingFeedbackDraft.empty;
      return TrainingFeedbackDraft.fromSent(
        feedback: sent,
        messages: messagesAsync.value ?? const [],
      );
    });

/// Préparations de tous les coachs de la séance.
final trainingPlansProvider = StreamProvider.autoDispose
    .family<List<TrainingPlan>, TrainingEventRef>((ref, target) {
      if (ref.watch(trainingAuthUidProvider) == null) {
        return Stream.value(const []);
      }
      return ref
          .watch(trainingPlanServiceProvider)
          .watchPlans(clubId: target.clubId, eventId: target.eventId);
    });

/// Exercices de la préparation d'un coach, dans l'ordre de sa préparation.
final trainingDrillsProvider = StreamProvider.autoDispose
    .family<List<TrainingDrill>, TrainingCoachRef>((ref, target) {
      return ref
          .watch(trainingPlanServiceProvider)
          .watchDrills(
            clubId: target.clubId,
            eventId: target.eventId,
            coachUid: target.coachUid,
          );
    });

/// Préparation d'un coach ([TrainingPlan] vide s'il n'a rien commencé).
final trainingCoachPlanProvider = Provider.autoDispose
    .family<TrainingPlan, TrainingCoachRef>((ref, target) {
      final plans =
          ref
              .watch(
                trainingPlansProvider((
                  clubId: target.clubId,
                  eventId: target.eventId,
                )),
              )
              .value ??
          const <TrainingPlan>[];
      return plans.firstWhere(
        (plan) => plan.coachUid == target.coachUid,
        orElse: () => TrainingPlan(coachUid: target.coachUid),
      );
    });

/// Bibliothèque de la séance [TrainingEventRef] : préparations (les miennes et
/// celles des collègues) des entraînements passés de mes équipes sur
/// [trainingLibraryPastDays] jours, hors séance en cours. Lue une fois.
final trainingLibraryProvider = FutureProvider.autoDispose
    .family<List<TrainingLibrarySession>, TrainingEventRef>((
      ref,
      target,
    ) async {
      final teamIds = ref.watch(clubAccessProvider(target.clubId)).coachTeamIds;
      if (ref.watch(trainingAuthUidProvider) == null || teamIds.isEmpty) {
        return const [];
      }
      final service = ref.watch(trainingPlanServiceProvider);
      final events = await service.loadPastTrainings(
        clubId: target.clubId,
        teamIds: teamIds,
        since: addCalendarDays(
          EventDateHelpers.startOfToday(),
          -trainingLibraryPastDays,
        ),
      );
      return service.loadLibrarySessions(
        clubId: target.clubId,
        events: events.where((e) => e.id != target.eventId).toList(),
      );
    });

/// Recherche dans la bibliothèque d'une séance.
typedef TrainingLibraryQuery = ({String clubId, String eventId, String query});

/// Vue filtrée de la bibliothèque : séances (avec le libellé de leurs
/// équipes) et exercices sans doublon correspondant à la recherche.
typedef TrainingLibraryView = ({
  List<({TrainingLibrarySession session, String teamsLabel})> sessions,
  List<TrainingLibraryDrillRow> drills,
});

/// Bibliothèque filtrée sur [TrainingLibraryQuery.query] (sans accents).
final trainingLibraryViewProvider = Provider.autoDispose
    .family<AsyncValue<TrainingLibraryView>, TrainingLibraryQuery>((
      ref,
      target,
    ) {
      final teams =
          ref.watch(clubTeamsProvider(target.clubId)).value ?? const [];
      final teamNames = {for (final team in teams) team.id: team.name};
      return ref
          .watch(
            trainingLibraryProvider((
              clubId: target.clubId,
              eventId: target.eventId,
            )),
          )
          .whenData((sessions) {
            return (
              sessions: [
                for (final session in filterLibrarySessions(
                  sessions,
                  target.query,
                ))
                  (
                    session: session,
                    teamsLabel: [
                      for (final teamId in session.event.teamIds)
                        ?teamNames[teamId],
                    ].join(', '),
                  ),
              ],
              drills: libraryDrillRows(sessions, target.query),
            );
          });
    });

/// Exercices ordonnés de la préparation d'un coach.
final trainingOrderedDrillsProvider = Provider.autoDispose
    .family<AsyncValue<List<TrainingDrill>>, TrainingCoachRef>((ref, target) {
      final plan = ref.watch(trainingCoachPlanProvider(target));
      return ref
          .watch(trainingDrillsProvider(target))
          .whenData((drills) => plan.ordered(drills));
    });

/// Joueurs d'un entraînement pour le retour : convoqués hors coachs des
/// équipes, ceux qui ont répondu « non » en dernier, puis par nom.
final trainingFeedbackPlayersProvider = Provider.autoDispose
    .family<List<ClubMember>, TrainingEventRef>((ref, target) {
      final event = ref.watch(trainingEventProvider(target)).value;
      if (event == null) return const [];
      final teams =
          ref.watch(clubTeamsProvider(target.clubId)).value ?? const [];
      final coachIds = {
        for (final team in teams)
          if (event.teamIds.contains(team.id)) ...team.coachIds,
      };
      final convoked = event.playerMemberIds(coachIds).toSet();
      final members =
          ref.watch(clubMembersProvider(target.clubId)).value ?? const [];
      final players =
          members.where((member) => convoked.contains(member.memberId)).toList()
            ..sort((a, b) {
              final aNo = event.rsvpStatusForUser(a.memberId) == RsvpStatus.no;
              final bNo = event.rsvpStatusForUser(b.memberId) == RsvpStatus.no;
              if (aNo != bNo) return aNo ? 1 : -1;
              return a.fullName.toLowerCase().compareTo(
                b.fullName.toLowerCase(),
              );
            });
      return players;
    });

/// Fiches du club indexées par id (noms des destinataires en consultation).
final trainingMembersByIdProvider = Provider.autoDispose
    .family<Map<String, ClubMember>, String>((ref, clubId) {
      final members = ref.watch(clubMembersProvider(clubId)).value ?? const [];
      return {for (final member in members) member.memberId: member};
    });
