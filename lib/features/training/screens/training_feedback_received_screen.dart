import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/features/training/widgets/training_feedback_received_card.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// « Retour du coach » côté joueur / parent : les retours de chaque coach
/// sur la séance (notes, mot au collectif, mot perso de [memberId]).
/// L'ouverture marque ces retours comme lus : la tuile d'accueil disparaît,
/// ils restent accessibles depuis la fiche de l'entraînement.
class TrainingFeedbackReceivedScreen extends ConsumerStatefulWidget {
  const TrainingFeedbackReceivedScreen({
    super.key,
    required this.clubId,
    required this.eventId,
    required this.memberId,
  });

  final String clubId;
  final String eventId;

  /// Fiche destinataire (soi ou enfant).
  final String memberId;

  @override
  ConsumerState<TrainingFeedbackReceivedScreen> createState() =>
      _TrainingFeedbackReceivedScreenState();
}

class _TrainingFeedbackReceivedScreenState
    extends ConsumerState<TrainingFeedbackReceivedScreen> {
  /// Coachs déjà marqués lus pendant cette visite (pas d'écriture en double).
  final Set<String> _marked = {};

  @override
  void initState() {
    super.initState();
    ref.listenManual(
      trainingFeedbacksProvider((
        clubId: widget.clubId,
        eventId: widget.eventId,
      )),
      (_, next) => _markSeen(next.value ?? const []),
      fireImmediately: true,
    );
  }

  /// Marque lus les retours de [feedbacks] pas encore notés.
  void _markSeen(List<TrainingFeedback> feedbacks) {
    final uid = ref.read(trainingAuthUidProvider);
    if (uid == null || widget.memberId.isEmpty) return;
    final fresh = [
      for (final feedback in feedbacks)
        if (!_marked.contains(feedback.coachUid)) feedback.coachUid,
    ];
    if (fresh.isEmpty) return;
    _marked.addAll(fresh);
    // Échec silencieux : au pire la tuile d'accueil revient.
    ref
        .read(trainingFeedbackServiceProvider)
        .markSeen(
          uid: uid,
          clubId: widget.clubId,
          eventId: widget.eventId,
          memberId: widget.memberId,
          coachUids: fresh,
        )
        .catchError((_) => _marked.removeAll(fresh));
  }

  @override
  Widget build(BuildContext context) {
    final eventRef = (clubId: widget.clubId, eventId: widget.eventId);
    final eventAsync = ref.watch(trainingEventProvider(eventRef));
    final feedbackCount =
        ref.watch(trainingFeedbacksProvider(eventRef)).value?.length ?? 0;
    final readers =
        ref.watch(trainingFeedbackReadersProvider(widget.clubId)).value ??
        const [];
    final childFirstName = readers
        .where((reader) => reader.memberId == widget.memberId)
        .map((reader) => reader.childFirstName)
        .firstOrNull;
    final fallback = AppRoutes.trainingFeedbackHubPath(
      tab: TrainingFeedbackHubTab.mine,
    );
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;

    return ViroScaffold(
      fallbackRoute: fallback,
      appBar: ViroAppBar(
        fallbackRoute: fallback,
        title: Text(AppCopy.training.receivedScreenTitle),
      ),
      body: eventAsync.when(
        loading: () => const Center(child: ViroLogoLoader()),
        error: (_, _) => ViroErrorState(message: AppCopy.training.loadError),
        data: (event) {
          if (event == null) {
            return ViroErrorState(message: AppCopy.training.loadError);
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.screenHorizontal,
              ViroSpacing.md,
              ViroSpacing.screenHorizontal,
              ViroSpacing.lg,
            ),
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
                style: theme.bodySmall?.copyWith(color: palette.textSecondary),
              ),
              const SizedBox(height: ViroSpacing.sm),
              Text(
                feedbackCount == 0
                    ? AppCopy.training.receivedEmpty
                    : AppCopy.training.receivedIntro(feedbackCount),
                style: theme.bodyMedium?.copyWith(color: palette.textPrimary),
              ),
              TrainingFeedbackReceivedCard(
                clubId: widget.clubId,
                eventId: widget.eventId,
                memberId: widget.memberId,
                childFirstName: childFirstName,
                showTitle: false,
              ),
            ],
          );
        },
      ),
    );
  }
}
