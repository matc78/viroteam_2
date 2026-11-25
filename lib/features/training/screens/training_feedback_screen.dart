import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/navigation_fallback.dart';
import 'package:viro_team_v2/config/project_config.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/features/training/widgets/training_rating_row.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/training_feedback.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/training/training_feedback_service.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_expandable_tile_grid.dart';
import 'package:viro_team_v2/widgets/lists/training_player_message_grid_tile.dart';

/// Délai avant d'enregistrer le brouillon après une saisie.
const Duration _draftSaveDelay = Duration(milliseconds: 900);

/// Attente max d'un enregistrement de brouillon en cours avant l'envoi
/// (hors ligne, l'écriture ne se termine qu'au retour du réseau).
const Duration _draftSaveWait = Duration(seconds: 5);

/// Retour de séance d'un coach : deux notes collectives, mot au collectif et
/// messages perso facultatifs. Le brouillon s'enregistre tout seul ; l'envoi
/// passe par la callable `sendTrainingFeedback`.
class TrainingFeedbackScreen extends ConsumerWidget {
  const TrainingFeedbackScreen({
    super.key,
    required this.clubId,
    required this.eventId,
  });

  final String clubId;
  final String eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventAsync = ref.watch(
      trainingEventProvider((clubId: clubId, eventId: eventId)),
    );
    final uid = ref.watch(trainingAuthUidProvider);
    final access = ref.watch(clubAccessProvider(clubId));
    final fallback = AppRoutes.clubTrainingFeedbackListPath(clubId);

    return ViroScaffold(
      fallbackRoute: fallback,
      appBar: ViroAppBar(
        fallbackRoute: fallback,
        title: Text(AppCopy.training.feedbackTitle),
      ),
      body: eventAsync.when(
        loading: () => const Center(child: ViroLogoLoader()),
        error: (_, _) => ViroErrorState(message: AppCopy.training.loadError),
        data: (event) {
          if (event == null || uid == null) {
            return ViroErrorState(message: AppCopy.training.loadError);
          }
          if (!access.canCoachTraining(
            event.teamIds,
            allTeams: event.allTeams,
          )) {
            return ViroEmptyState(
              icon: ViroIcons.lock,
              message: AppCopy.training.notCoach,
            );
          }
          if (event.date.isAfter(DateTime.now())) {
            return ViroEmptyState(
              icon: ViroIcons.clock,
              message: AppCopy.training.notPastYet,
            );
          }
          final initialDraft = ref.watch(
            trainingFeedbackInitialDraftProvider((
              clubId: clubId,
              eventId: eventId,
              coachUid: uid,
            )),
          );
          if (initialDraft == null) {
            return const Center(child: ViroLogoLoader());
          }
          return _FeedbackEditor(
            clubId: clubId,
            event: event,
            uid: uid,
            initialDraft: initialDraft,
          );
        },
      ),
    );
  }
}

/// Saisie du retour : brouillon local enregistré tout seul, envoi.
/// [initialDraft] n'est lu qu'à la création (la saisie prend ensuite le
/// relais).
class _FeedbackEditor extends ConsumerStatefulWidget {
  const _FeedbackEditor({
    required this.clubId,
    required this.event,
    required this.uid,
    required this.initialDraft,
  });

  final String clubId;
  final ClubEvent event;
  final String uid;
  final TrainingFeedbackDraft initialDraft;

  @override
  ConsumerState<_FeedbackEditor> createState() => _FeedbackEditorState();
}

class _FeedbackEditorState extends ConsumerState<_FeedbackEditor> {
  late TrainingFeedbackDraft _draft = widget.initialDraft;
  late final TextEditingController _collectiveController =
      TextEditingController(text: widget.initialDraft.collectiveMessage);
  Timer? _saveTimer;

  /// Enregistrement du brouillon en cours (attendu avant l'envoi).
  Future<void>? _draftSave;
  bool _sending = false;
  String? _expandedPlayerId;

  // Lu une fois : le brouillon peut s'écrire pendant dispose (ref interdit).
  late final TrainingFeedbackService _service = ref.read(
    trainingFeedbackServiceProvider,
  );

  String get _fallback => AppRoutes.clubTrainingFeedbackListPath(widget.clubId);

  @override
  void dispose() {
    // Dernière saisie non encore enregistrée : on l'écrit en partant.
    if (_saveTimer?.isActive ?? false) {
      _saveTimer!.cancel();
      unawaited(_saveDraft());
    }
    _collectiveController.dispose();
    super.dispose();
  }

  void _update(TrainingFeedbackDraft next) {
    setState(() => _draft = next);
    _saveTimer?.cancel();
    _saveTimer = Timer(_draftSaveDelay, () => _draftSave = _saveDraft());
  }

  Future<void> _saveDraft() async {
    try {
      await _service.saveDraft(
        clubId: widget.clubId,
        eventId: widget.event.id,
        coachUid: widget.uid,
        draft: _draft,
      );
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.training.draftSaveFailed);
    }
  }

  Future<void> _send({
    required TrainingFeedbackDraft draft,
    required List<ClubMember> players,
    required bool resend,
  }) async {
    if (_sending) return;
    final messages = draft.messagesFor(players.map((p) => p.memberId));
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(AppCopy.training.sendConfirmTitle),
        content: Text(
          resend
              ? AppCopy.training.resendConfirmBody
              : AppCopy.training.sendConfirmBody(messages.length),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(AppCopy.common.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(AppCopy.training.sendConfirm),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    _saveTimer?.cancel();
    // Navigator capturé avant l'appel : le dialog non fermable doit partir
    // même si l'écran est démonté pendant l'envoi.
    final navigator = Navigator.of(context, rootNavigator: true);
    setState(() => _sending = true);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => PopScope(
        canPop: false,
        child: AlertDialog(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ViroLogoLoader(size: 56),
              const SizedBox(height: ViroSpacing.md),
              Text(
                AppCopy.training.sending,
                textAlign: TextAlign.center,
                style: Theme.of(dialogContext).textTheme.bodyMedium?.copyWith(
                  color: dialogContext.viroPalette.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
    var sentOk = false;
    try {
      // Un brouillon écrit après l'envoi reviendrait à la place du retour.
      await _draftSave?.timeout(_draftSaveWait, onTimeout: () {});
      await _service.send(
        clubId: widget.clubId,
        eventId: widget.event.id,
        levelRating: draft.levelRating!,
        engagementRating: draft.engagementRating!,
        collectiveMessage: draft.collectiveMessage,
        playerMessages: messages,
      );
      sentOk = true;
    } catch (_) {
      if (!mounted) return;
      ViroHaptics.error();
      ViroSnackBar.show(context, AppCopy.training.sendFailed);
    } finally {
      if (navigator.canPop()) navigator.pop();
      if (mounted) setState(() => _sending = false);
    }
    if (!sentOk || !mounted) return;
    ViroHaptics.success();
    ViroSnackBar.show(
      context,
      resend ? AppCopy.training.updated : AppCopy.training.sent,
    );
    popOrGo(context, _fallback);
  }

  @override
  Widget build(BuildContext context) {
    final event = widget.event;
    return IgnorePointer(
      ignoring: _sending,
      child: _FeedbackForm(
        event: event,
        draft: _draft,
        players: ref.watch(
          trainingFeedbackPlayersProvider((
            clubId: widget.clubId,
            eventId: event.id,
          )),
        ),
        resend: event.trainingFeedbackSentByCoach(widget.uid),
        sending: _sending,
        collectiveController: _collectiveController,
        onChanged: _update,
        onSend: _send,
        expandedPlayerId: _expandedPlayerId,
        onExpandPlayer: (memberId) =>
            setState(() => _expandedPlayerId = memberId),
      ),
    );
  }
}

/// Formulaire du retour (présentation seule ; l'état vit dans l'écran).
class _FeedbackForm extends StatelessWidget {
  const _FeedbackForm({
    required this.event,
    required this.draft,
    required this.players,
    required this.resend,
    required this.sending,
    required this.collectiveController,
    required this.onChanged,
    required this.onSend,
    required this.expandedPlayerId,
    required this.onExpandPlayer,
  });

  final ClubEvent event;
  final TrainingFeedbackDraft draft;
  final List<ClubMember> players;
  final bool resend;
  final bool sending;
  final TextEditingController collectiveController;
  final ValueChanged<TrainingFeedbackDraft> onChanged;
  final Future<void> Function({
    required TrainingFeedbackDraft draft,
    required List<ClubMember> players,
    required bool resend,
  })
  onSend;

  /// Joueur dont la tuile est dépliée (`null` si aucune).
  final String? expandedPlayerId;
  final ValueChanged<String?> onExpandPlayer;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final textScaler = MediaQuery.textScalerOf(context);
    final messageCount = draft
        .messagesFor(players.map((p) => p.memberId))
        .length;
    final expandedIndex = players.indexWhere(
      (player) => player.memberId == expandedPlayerId,
    );
    final sectionTitleStyle = theme.titleMedium?.copyWith(
      color: palette.brandText,
      fontWeight: FontWeight.w800,
    );
    final hintStyle = theme.bodySmall?.copyWith(color: palette.textSecondary);

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.screenHorizontal,
              ViroSpacing.md,
              ViroSpacing.screenHorizontal,
              ViroSpacing.lg,
            ),
            children: [
              _CenteredContent(
                child: Column(
                  children: [
                    Text(
                      PlanningEventDisplay.calendarTitle(event),
                      textAlign: TextAlign.center,
                      style: sectionTitleStyle,
                    ),
                    Text(
                      formatEventDate(event.date),
                      textAlign: TextAlign.center,
                      style: hintStyle,
                    ),
                    const SizedBox(height: ViroSpacing.lg),
                    ViroCard(
                      elevated: false,
                      margin: EdgeInsets.zero,
                      padding: const EdgeInsets.all(ViroSpacing.md),
                      child: Column(
                        children: [
                          Text(
                            AppCopy.training.collectiveSection,
                            textAlign: TextAlign.center,
                            style: sectionTitleStyle,
                          ),
                          const SizedBox(height: ViroSpacing.md),
                          TrainingRatingRow(
                            label: AppCopy.training.levelLabel,
                            hint: AppCopy.training.levelHint,
                            value: draft.levelRating,
                            onChanged: (value) =>
                                onChanged(draft.copyWith(levelRating: value)),
                          ),
                          const SizedBox(height: ViroSpacing.md),
                          TrainingRatingRow(
                            label: AppCopy.training.engagementLabel,
                            hint: AppCopy.training.engagementHint,
                            value: draft.engagementRating,
                            onChanged: (value) => onChanged(
                              draft.copyWith(engagementRating: value),
                            ),
                          ),
                          const SizedBox(height: ViroSpacing.md),
                          TextField(
                            controller: collectiveController,
                            onChanged: (text) => onChanged(
                              draft.copyWith(collectiveMessage: text),
                            ),
                            minLines: 2,
                            maxLines: 6,
                            maxLength: TrainingRatings.messageMaxChars,
                            textCapitalization: TextCapitalization.sentences,
                            decoration: InputDecoration(
                              labelText:
                                  AppCopy.training.collectiveMessageLabel,
                              hintText: AppCopy.training.collectiveMessageHint,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: ViroSpacing.lg),
                    Text(
                      AppCopy.training.playersSection,
                      textAlign: TextAlign.center,
                      style: sectionTitleStyle,
                    ),
                    const SizedBox(height: ViroSpacing.xs),
                    Text(
                      AppCopy.training.playersHint,
                      textAlign: TextAlign.center,
                      style: hintStyle,
                    ),
                    const SizedBox(height: ViroSpacing.md),
                    if (players.isEmpty)
                      Text(
                        AppCopy.training.playersEmpty,
                        textAlign: TextAlign.center,
                        style: theme.bodyMedium?.copyWith(
                          color: palette.textMuted,
                        ),
                      )
                    else
                      ViroExpandableTileGrid(
                        itemCount: players.length,
                        expandedIndex: expandedIndex < 0 ? null : expandedIndex,
                        tileHeight: TrainingPlayerMessageGridTile.compactHeight(
                          textScaler,
                        ),
                        expandedHeight:
                            TrainingPlayerMessageGridTile.expandedHeight(
                              textScaler,
                            ),
                        itemKey: (index) => ValueKey(players[index].memberId),
                        itemBuilder: (_, index, expanded) {
                          final memberId = players[index].memberId;
                          return TrainingPlayerMessageGridTile(
                            member: players[index],
                            message: draft.playerMessages[memberId] ?? '',
                            expanded: expanded,
                            onExpand: () => onExpandPlayer(memberId),
                            onCollapse: () => onExpandPlayer(null),
                            onChanged: (text) => onChanged(
                              draft.withPlayerMessage(memberId, text),
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.screenHorizontal,
              ViroSpacing.sm,
              ViroSpacing.screenHorizontal,
              ViroSpacing.sm,
            ),
            child: _CenteredContent(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (!draft.canSend)
                    Padding(
                      padding: const EdgeInsets.only(bottom: ViroSpacing.xs),
                      child: Text(
                        AppCopy.training.ratingsRequired,
                        textAlign: TextAlign.center,
                        style: hintStyle,
                      ),
                    ),
                  ElevatedButton(
                    onPressed: !draft.canSend || sending
                        ? null
                        : () => onSend(
                            draft: draft,
                            players: players,
                            resend: resend,
                          ),
                    child: Text(
                      sending
                          ? AppCopy.training.sending
                          : resend
                          ? AppCopy.training.resendAction
                          : AppCopy.training.sendAction(messageCount),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Contenu centré, limité à la largeur de lecture sur tablette.
class _CenteredContent extends StatelessWidget {
  const _CenteredContent({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          maxWidth: ProjectConfig.contentMaxWidth,
        ),
        child: child,
      ),
    );
  }
}
