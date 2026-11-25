import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/features/training/widgets/training_feedback_summary_card.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/training_player_message_list_tile.dart';

/// Consultation des retours envoyés sur une séance (lecture seule) : une
/// section par coach avec ses notes, son mot au collectif et ses messages
/// perso. Ouvert aux coachs de la séance et aux admins du club.
class TrainingFeedbackReviewScreen extends ConsumerWidget {
  const TrainingFeedbackReviewScreen({
    super.key,
    required this.clubId,
    required this.eventId,
    this.coachUid,
  });

  final String clubId;
  final String eventId;

  /// Coach dont on consulte le retour (tous les coachs si `null`).
  final String? coachUid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventRef = (clubId: clubId, eventId: eventId);
    final eventAsync = ref.watch(trainingEventProvider(eventRef));
    final access = ref.watch(clubAccessProvider(clubId));
    final fallback = AppRoutes.clubPlanningPath(clubId);
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;

    return ViroScaffold(
      fallbackRoute: fallback,
      appBar: ViroAppBar(
        fallbackRoute: fallback,
        title: Text(AppCopy.training.reviewTitle),
      ),
      body: eventAsync.when(
        loading: () => const Center(child: ViroLogoLoader()),
        error: (_, _) => ViroErrorState(message: AppCopy.training.loadError),
        data: (event) {
          if (event == null) {
            return ViroErrorState(message: AppCopy.training.loadError);
          }
          if (!access.canReviewTraining(
            event.teamIds,
            allTeams: event.allTeams,
          )) {
            return ViroEmptyState(
              icon: ViroIcons.lock,
              message: AppCopy.training.notCoach,
            );
          }
          final feedbacks = [
            for (final feedback
                in ref.watch(trainingFeedbacksProvider(eventRef)).value ??
                    const <TrainingFeedback>[])
              if (coachUid == null || feedback.coachUid == coachUid) feedback,
          ];
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.screenHorizontal,
              ViroSpacing.md,
              ViroSpacing.screenHorizontal,
              ViroSpacing.lg,
            ),
            itemCount: feedbacks.length + 1,
            itemBuilder: (context, index) {
              if (index == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: ViroSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        PlanningEventDisplay.calendarTitle(event),
                        style: theme.titleMedium?.copyWith(
                          color: palette.brandText,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        formatEventDate(event.date),
                        style: theme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                      const SizedBox(height: ViroSpacing.sm),
                      Text(
                        feedbacks.isEmpty
                            ? AppCopy.training.reviewEmpty
                            : AppCopy.training.reviewReadOnly,
                        style: theme.bodySmall?.copyWith(
                          color: palette.textMuted,
                        ),
                      ),
                    ],
                  ),
                );
              }
              return _CoachFeedbackSection(
                clubId: clubId,
                eventId: eventId,
                feedback: feedbacks[index - 1],
              );
            },
          );
        },
      ),
    );
  }
}

/// Retour d'un coach et la liste de ses messages perso (lecture seule).
class _CoachFeedbackSection extends ConsumerWidget {
  const _CoachFeedbackSection({
    required this.clubId,
    required this.eventId,
    required this.feedback,
  });

  final String clubId;
  final String eventId;
  final TrainingFeedback feedback;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final messages =
        ref
            .watch(
              trainingCoachMessagesProvider((
                clubId: clubId,
                eventId: eventId,
                coachUid: feedback.coachUid,
              )),
            )
            .value ??
        const <TrainingPlayerMessage>[];
    final membersById = ref.watch(trainingMembersByIdProvider(clubId));

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.md),
      child: TrainingFeedbackSummaryCard(
        feedback: feedback,
        footer: messages.isEmpty
            ? null
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: ViroSpacing.md),
                  Text(
                    AppCopy.training.reviewPlayerMessages,
                    style: theme.labelLarge?.copyWith(
                      color: palette.brandText,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: ViroSpacing.sm),
                  for (final message in messages)
                    TrainingPlayerMessageListTile(
                      member:
                          membersById[message.memberId] ??
                          ClubMember(memberId: message.memberId, status: ''),
                      message: message.message,
                      readOnly: true,
                    ),
                ],
              ),
      ),
    );
  }
}
