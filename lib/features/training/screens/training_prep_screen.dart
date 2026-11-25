import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/training/training_plan_service.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/training_drill_list_tile.dart';

/// Délai avant d'enregistrer les notes après une saisie.
const Duration _notesSaveDelay = Duration(milliseconds: 900);

/// Préparation d'un entraînement : une partie par coach (notes libres +
/// exercices). Ma partie est modifiable, celles des collègues en lecture
/// seule ; l'admin consulte sans rien écrire.
class TrainingPrepScreen extends ConsumerStatefulWidget {
  const TrainingPrepScreen({
    super.key,
    required this.clubId,
    required this.eventId,
  });

  final String clubId;
  final String eventId;

  @override
  ConsumerState<TrainingPrepScreen> createState() => _TrainingPrepScreenState();
}

class _TrainingPrepScreenState extends ConsumerState<TrainingPrepScreen> {
  /// Coach dont on affiche la partie (`null` = la mienne, ou la première).
  String? _selectedCoachUid;
  final TextEditingController _notesController = TextEditingController();
  bool _notesLoaded = false;
  Timer? _notesTimer;

  // Lus une fois : les notes peuvent s'écrire pendant dispose (ref interdit).
  late final TrainingPlanService _service = ref.read(
    trainingPlanServiceProvider,
  );
  _PlanContext? _context;

  TrainingEventRef get _eventRef =>
      (clubId: widget.clubId, eventId: widget.eventId);

  @override
  void dispose() {
    if (_notesTimer?.isActive ?? false) {
      _notesTimer!.cancel();
      unawaited(_saveNotes());
    }
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _saveNotes() async {
    final planContext = _context;
    if (planContext == null) return;
    try {
      await _service.savePlan(
        clubId: widget.clubId,
        eventId: widget.eventId,
        coachUid: planContext.uid,
        coachName: planContext.coachName,
        teamIds: planContext.teamIds,
        notes: _notesController.text,
      );
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.training.saveFailed);
    }
  }

  void _onNotesChanged(String _) {
    _notesTimer?.cancel();
    _notesTimer = Timer(_notesSaveDelay, _saveNotes);
  }

  Future<void> _addDrill(List<TrainingDrill> drills) async {
    final planContext = _context;
    if (planContext == null) return;
    final drill = TrainingDrill(
      id: _service.newDrillId(
        clubId: widget.clubId,
        eventId: widget.eventId,
        coachUid: planContext.uid,
      ),
    );
    try {
      await _service.saveDrill(
        clubId: widget.clubId,
        eventId: widget.eventId,
        coachUid: planContext.uid,
        drill: drill,
      );
      await _service.savePlan(
        clubId: widget.clubId,
        eventId: widget.eventId,
        coachUid: planContext.uid,
        coachName: planContext.coachName,
        teamIds: planContext.teamIds,
        drillOrder: [...drills.map((d) => d.id), drill.id],
      );
      if (!mounted) return;
      context.push(
        AppRoutes.clubTrainingDrillPath(
          widget.clubId,
          widget.eventId,
          planContext.uid,
          drill.id,
        ),
      );
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.training.saveFailed);
    }
  }

  /// Déplace l'exercice [oldIndex] en [newIndex] (index déjà ajusté).
  Future<void> _reorder(
    List<TrainingDrill> drills,
    int oldIndex,
    int newIndex,
  ) async {
    final planContext = _context;
    if (planContext == null) return;
    final ids = drills.map((d) => d.id).toList();
    final moved = ids.removeAt(oldIndex);
    ids.insert(newIndex, moved);
    try {
      await _service.savePlan(
        clubId: widget.clubId,
        eventId: widget.eventId,
        coachUid: planContext.uid,
        coachName: planContext.coachName,
        teamIds: planContext.teamIds,
        drillOrder: ids,
      );
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.training.saveFailed);
    }
  }

  void _openDrill(String coachUid, String drillId) => context.push(
    AppRoutes.clubTrainingDrillPath(
      widget.clubId,
      widget.eventId,
      coachUid,
      drillId,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final eventAsync = ref.watch(trainingEventProvider(_eventRef));
    final uid = ref.watch(trainingAuthUidProvider);
    final access = ref.watch(clubAccessProvider(widget.clubId));
    final fallback = AppRoutes.clubPlanningPath(widget.clubId);

    return ViroScaffold(
      fallbackRoute: fallback,
      appBar: ViroAppBar(
        fallbackRoute: fallback,
        title: Text(AppCopy.training.prepTitle),
      ),
      body: eventAsync.when(
        loading: () => const Center(child: ViroLogoLoader()),
        error: (_, _) => ViroErrorState(message: AppCopy.training.loadError),
        data: (event) {
          if (event == null || uid == null) {
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
          final isCoach = access.canCoachTraining(
            event.teamIds,
            allTeams: event.allTeams,
          );
          final plans =
              ref.watch(trainingPlansProvider(_eventRef)).value ?? const [];
          final colleagues =
              plans.where((plan) => plan.coachUid != uid).toList()
                ..sort((a, b) => a.coachName.compareTo(b.coachName));
          final coachUids = [
            if (isCoach) uid,
            ...colleagues.map((p) => p.coachUid),
          ];
          if (coachUids.isEmpty) {
            return ViroEmptyState(
              icon: ViroIcons.trainingPrep,
              message: AppCopy.training.prepEmptyColleague,
            );
          }
          final selected = coachUids.contains(_selectedCoachUid)
              ? _selectedCoachUid!
              : coachUids.first;
          final mine = selected == uid && isCoach;
          if (isCoach) {
            _context = _PlanContext(
              uid: uid,
              coachName:
                  ref
                      .watch(clubMemberProvider(widget.clubId))
                      .value
                      ?.fullName ??
                  '',
              teamIds: event.teamIds,
            );
          }
          final plan = ref.watch(
            trainingCoachPlanProvider((
              clubId: widget.clubId,
              eventId: widget.eventId,
              coachUid: selected,
            )),
          );
          if (mine &&
              !_notesLoaded &&
              ref.watch(trainingPlansProvider(_eventRef)).hasValue) {
            _notesController.text = plan.notes;
            _notesLoaded = true;
          }
          final drillsAsync = ref.watch(
            trainingOrderedDrillsProvider((
              clubId: widget.clubId,
              eventId: widget.eventId,
              coachUid: selected,
            )),
          );
          final drills = drillsAsync.value ?? const <TrainingDrill>[];

          final header = _PrepHeader(
            event: event,
            coaches: [
              for (final coachUid in coachUids)
                (
                  uid: coachUid,
                  label: coachUid == uid && isCoach
                      ? AppCopy.training.prepMine
                      : AppCopy.training.prepColleague(
                          plans
                                  .where((p) => p.coachUid == coachUid)
                                  .firstOrNull
                                  ?.coachName ??
                              '',
                        ),
                ),
            ],
            selectedCoachUid: selected,
            onSelectCoach: (coachUid) =>
                setState(() => _selectedCoachUid = coachUid),
            mine: mine,
            notes: plan.notes,
            notesController: _notesController,
            onNotesChanged: _onNotesChanged,
            drills: drills,
          );

          final padding = const EdgeInsets.fromLTRB(
            ViroSpacing.screenHorizontal,
            ViroSpacing.md,
            ViroSpacing.screenHorizontal,
            ViroSpacing.lg,
          );
          if (!mine) {
            return ListView.builder(
              padding: padding,
              itemCount: drills.length + 1,
              itemBuilder: (context, index) => index == 0
                  ? header
                  : TrainingDrillListTile(
                      drill: drills[index - 1],
                      position: index,
                      onTap: () => _openDrill(selected, drills[index - 1].id),
                    ),
            );
          }
          return ReorderableListView.builder(
            padding: padding,
            buildDefaultDragHandles: false,
            header: header,
            footer: Padding(
              padding: const EdgeInsets.only(top: ViroSpacing.xs),
              child: OutlinedButton.icon(
                onPressed: () => _addDrill(drills),
                icon: ViroIcon(ViroIcons.add, size: 18),
                label: Text(AppCopy.training.addDrill),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(
                    ViroSpacing.buttonHeightMedium,
                  ),
                ),
              ),
            ),
            itemCount: drills.length,
            onReorderItem: (oldIndex, newIndex) =>
                _reorder(drills, oldIndex, newIndex),
            itemBuilder: (context, index) => TrainingDrillListTile(
              key: ValueKey(drills[index].id),
              drill: drills[index],
              position: index + 1,
              onTap: () => _openDrill(selected, drills[index].id),
              dragHandle: ReorderableDragStartListener(
                index: index,
                child: Tooltip(
                  message: AppCopy.training.reorderHint,
                  child: SizedBox.square(
                    dimension: ViroSpacing.minTouchTarget,
                    child: Center(
                      child: ViroIcon(
                        ViroIcons.dragHandle,
                        color: context.viroPalette.textMuted,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Infos nécessaires pour écrire ma partie (règles : `teamIds` de la séance).
class _PlanContext {
  const _PlanContext({
    required this.uid,
    required this.coachName,
    required this.teamIds,
  });

  final String uid;
  final String coachName;
  final List<String> teamIds;
}

/// En-tête : séance, choix du coach, notes libres et durée prévue.
class _PrepHeader extends StatelessWidget {
  const _PrepHeader({
    required this.event,
    required this.coaches,
    required this.selectedCoachUid,
    required this.onSelectCoach,
    required this.mine,
    required this.notes,
    required this.notesController,
    required this.onNotesChanged,
    required this.drills,
  });

  final ClubEvent event;
  final List<({String uid, String label})> coaches;
  final String selectedCoachUid;
  final ValueChanged<String> onSelectCoach;
  final bool mine;
  final String notes;
  final TextEditingController notesController;
  final ValueChanged<String> onNotesChanged;
  final List<TrainingDrill> drills;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final session = sessionMinutes(event.startTime, event.endTime);
    final planned = plannedMinutes(drills);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
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
        if (coaches.length > 1) ...[
          const SizedBox(height: ViroSpacing.md),
          Wrap(
            spacing: ViroSpacing.sm,
            runSpacing: ViroSpacing.xs,
            children: [
              for (final coach in coaches)
                ChoiceChip(
                  label: Text(coach.label),
                  selected: coach.uid == selectedCoachUid,
                  onSelected: (_) => onSelectCoach(coach.uid),
                ),
            ],
          ),
        ],
        const SizedBox(height: ViroSpacing.md),
        if (mine)
          TextField(
            controller: notesController,
            onChanged: onNotesChanged,
            minLines: 3,
            maxLines: 10,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: AppCopy.training.notesLabel,
              hintText: AppCopy.training.notesHint,
              alignLabelWithHint: true,
            ),
          )
        else ...[
          Text(
            AppCopy.training.prepReadOnly,
            style: theme.bodySmall?.copyWith(color: palette.textMuted),
          ),
          const SizedBox(height: ViroSpacing.sm),
          Text(
            AppCopy.training.notesLabel,
            style: theme.labelLarge?.copyWith(
              color: palette.brandText,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            notes.trim().isEmpty ? AppCopy.training.prepEmptyColleague : notes,
            style: theme.bodyMedium?.copyWith(
              color: notes.trim().isEmpty
                  ? palette.textMuted
                  : palette.textPrimary,
            ),
          ),
        ],
        const SizedBox(height: ViroSpacing.lg),
        Row(
          children: [
            Expanded(
              child: Text(
                AppCopy.training.drillsSection,
                style: theme.titleMedium?.copyWith(
                  color: palette.brandText,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            if (planned > 0)
              Text(
                AppCopy.training.plannedDuration(planned, session),
                style: theme.bodySmall?.copyWith(
                  color: session != null && planned > session
                      ? palette.warningText
                      : palette.textSecondary,
                ),
              ),
          ],
        ),
        const SizedBox(height: ViroSpacing.sm),
        if (drills.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
            child: Text(
              mine
                  ? AppCopy.training.drillsEmpty
                  : AppCopy.training.prepEmptyColleague,
              style: theme.bodyMedium?.copyWith(color: palette.textMuted),
            ),
          ),
      ],
    );
  }
}
