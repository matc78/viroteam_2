import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/training_feedback.dart';

/// Fiche pour qui un compte lit les retours de séance : la sienne ou celle
/// d'un enfant ([childFirstName] renseigné), avec les équipes où elle joue.
typedef TrainingFeedbackReader = ({
  String memberId,
  List<String> teamIds,
  String? childFirstName,
});

/// Retours de séance reçus par un joueur (ou son parent) sur un
/// entraînement, lus ou non.
class TrainingFeedbackInboxItem {
  const TrainingFeedbackInboxItem({
    required this.event,
    required this.memberId,
    required this.coachUids,
    required this.unseenCoachUids,
    this.childFirstName,
  });

  final ClubEvent event;

  /// Fiche destinataire (soi ou enfant).
  final String memberId;

  /// Prénom de l'enfant quand un parent lit.
  final String? childFirstName;

  /// Coachs qui ont envoyé un retour.
  final List<String> coachUids;

  /// Coachs dont le retour n'a pas encore été lu.
  final List<String> unseenCoachUids;

  /// Au moins un retour pas encore lu.
  bool get isUnseen => unseenCoachUids.isNotEmpty;
}

/// Ligne de la liste « Feedback entraînement » d'un coach.
sealed class TrainingFeedbackListRow {
  const TrainingFeedbackListRow(this.event);

  final ClubEvent event;
}

/// Un entraînement et le statut de mon retour.
final class TrainingFeedbackEventRow extends TrainingFeedbackListRow {
  const TrainingFeedbackEventRow(super.event, this.status);

  final TrainingFeedbackStatus status;
}

/// Retour envoyé par un autre coach sur l'entraînement juste au-dessus.
final class TrainingFeedbackColleagueRow extends TrainingFeedbackListRow {
  const TrainingFeedbackColleagueRow(super.event, this.coachUid);

  final String coachUid;
}

/// Entraînement d'une équipe que je n'entraîne pas, avec des retours
/// envoyés (consultation admin).
final class TrainingFeedbackReviewRow extends TrainingFeedbackListRow {
  const TrainingFeedbackReviewRow(super.event);
}

/// Statut du retour de [uid] sur [event] : envoyé l'emporte sur « flemme ».
TrainingFeedbackStatus coachFeedbackStatus({
  required ClubEvent event,
  required String uid,
  TrainingFeedbackUserState? state,
}) {
  if (event.trainingFeedbackSentByCoach(uid)) {
    return TrainingFeedbackStatus.sent;
  }
  if (state?.skipped ?? false) return TrainingFeedbackStatus.skipped;
  return TrainingFeedbackStatus.todo;
}

/// Lignes de la liste coach : chaque entraînement, suivi des retours déjà
/// envoyés par ses collègues.
List<TrainingFeedbackListRow> buildCoachFeedbackRows({
  required List<ClubEvent> events,
  required String uid,
  required Map<String, TrainingFeedbackUserState> states,
}) => [
  for (final event in events) ...[
    TrainingFeedbackEventRow(
      event,
      coachFeedbackStatus(event: event, uid: uid, state: states[event.id]),
    ),
    for (final coachUid in event.trainingFeedbackSentBy)
      if (coachUid != uid) TrainingFeedbackColleagueRow(event, coachUid),
  ],
];

/// Entraînements depuis [since] dont le retour de [uid] reste à faire (ni
/// envoyé, ni « flemme ») : compteur de la tuile d'accueil coach.
int countPendingCoachFeedback({
  required List<ClubEvent> events,
  required String uid,
  required Map<String, TrainingFeedbackUserState> states,
  required DateTime since,
}) => events
    .where(
      (event) =>
          !event.date.isBefore(since) &&
          coachFeedbackStatus(
                event: event,
                uid: uid,
                state: states[event.id],
              ) ==
              TrainingFeedbackStatus.todo,
    )
    .length;

/// Retours reçus par les [readers] sur [events], lus ou non, du plus récent
/// au plus ancien. Un lecteur compte s'il était convoqué ; mes propres
/// retours ([uid] coach) sont ignorés.
List<TrainingFeedbackInboxItem> buildReceivedTrainingFeedback({
  required List<ClubEvent> events,
  required List<TrainingFeedbackReader> readers,
  required Map<String, TrainingFeedbackUserState> states,
  required String uid,
}) {
  final items = <TrainingFeedbackInboxItem>[];
  final sorted = [...events]..sort((a, b) => b.date.compareTo(a.date));
  for (final event in sorted) {
    final coachUids = [
      for (final coachUid in event.trainingFeedbackSentBy)
        if (coachUid != uid) coachUid,
    ];
    if (coachUids.isEmpty) continue;
    final state = states[event.id];
    for (final reader in readers) {
      if (!event.isInvitedAsPlayer(reader.memberId)) continue;
      items.add(
        TrainingFeedbackInboxItem(
          event: event,
          memberId: reader.memberId,
          childFirstName: reader.childFirstName,
          coachUids: coachUids,
          unseenCoachUids: [
            for (final coachUid in coachUids)
              if (!(state?.hasSeen(reader.memberId, coachUid) ?? false))
                coachUid,
          ],
        ),
      );
    }
  }
  return items;
}

/// Lignes de consultation admin : entraînements avec des retours envoyés,
/// hors équipes que j'entraîne (déjà dans mes lignes coach).
List<TrainingFeedbackReviewRow> buildAdminReviewRows({
  required List<ClubEvent> events,
  required Set<String> coachTeamIds,
}) => [
  for (final event in events)
    if (event.trainingFeedbackSentBy.isNotEmpty &&
        !event.teamIds.any(coachTeamIds.contains))
      TrainingFeedbackReviewRow(event),
];
