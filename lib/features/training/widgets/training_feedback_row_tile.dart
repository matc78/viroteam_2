import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/training/training_feedback_inbox.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/lists/training_colleague_feedback_list_tile.dart';
import 'package:viro_team_v2/widgets/lists/training_feedback_event_list_tile.dart';
import 'package:viro_team_v2/widgets/lists/training_feedback_review_event_list_tile.dart';

/// Tuile d'une ligne de gestion des retours : mon entraînement (tap = saisie,
/// appui long = « flemme »), retour d'un collègue ou consultation admin.
class TrainingFeedbackRowTile extends ConsumerWidget {
  const TrainingFeedbackRowTile({
    super.key,
    required this.clubId,
    required this.row,
  });

  final String clubId;
  final TrainingFeedbackListRow row;

  /// Bascule la « flemme » de [event] (retour pas encore envoyé).
  Future<void> _toggleSkipped(
    BuildContext context,
    WidgetRef ref,
    ClubEvent event,
    TrainingFeedbackStatus status,
  ) async {
    final uid = ref.read(trainingAuthUidProvider);
    if (uid == null) return;
    final skip = status == TrainingFeedbackStatus.todo;
    try {
      await ref
          .read(trainingFeedbackServiceProvider)
          .setSkipped(
            uid: uid,
            clubId: clubId,
            eventId: event.id,
            skipped: skip,
          );
      if (!context.mounted) return;
      ViroSnackBar.show(
        context,
        skip ? AppCopy.training.skippedToast : AppCopy.training.unskippedToast,
      );
    } catch (_) {
      if (!context.mounted) return;
      ViroSnackBar.show(context, AppCopy.training.skipFailed);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teamsById = <String, ClubTeam>{
      for (final team in ref.watch(clubTeamsProvider(clubId)).value ?? const [])
        team.id: team,
    };
    final event = row.event;
    final title = PlanningEventDisplay.calendarTitle(event);
    final dateLabel = formatEventDate(event.date);
    // Le titre d'un entraînement est souvent le nom de l'équipe : pas de
    // doublon dans le sous-titre.
    final rawTeamLabel = PlanningEventDisplay.teamLabel(event, teamsById);
    final teamLabel = rawTeamLabel == title ? null : rawTeamLabel;
    final uid = ref.watch(trainingAuthUidProvider);

    return switch (row) {
      TrainingFeedbackEventRow(:final status) => TrainingFeedbackEventListTile(
        title: title,
        dateLabel: dateLabel,
        teamLabel: teamLabel,
        status: status,
        attachedBelow: event.trainingFeedbackSentBy.any(
          (coachUid) => coachUid != uid,
        ),
        onTap: () =>
            context.push(AppRoutes.clubTrainingFeedbackPath(clubId, event.id)),
        onLongPress: status == TrainingFeedbackStatus.sent
            ? null
            : ViroHaptics.longPress(
                () => _toggleSkipped(context, ref, event, status),
              ),
      ),
      TrainingFeedbackColleagueRow(:final coachUid) =>
        TrainingColleagueFeedbackListTile(
          coachName:
              ref
                  .watch(trainingMembersByIdProvider(clubId))[coachUid]
                  ?.fullName ??
              '',
          onTap: () => context.push(
            AppRoutes.clubTrainingFeedbackReviewPath(
              clubId,
              event.id,
              coachUid: coachUid,
            ),
          ),
        ),
      TrainingFeedbackReviewRow() => TrainingFeedbackReviewEventListTile(
        title: title,
        dateLabel: dateLabel,
        teamLabel: teamLabel,
        feedbackCount: event.trainingFeedbackSentBy.length,
        onTap: () => context.push(
          AppRoutes.clubTrainingFeedbackReviewPath(clubId, event.id),
        ),
      ),
    };
  }
}
