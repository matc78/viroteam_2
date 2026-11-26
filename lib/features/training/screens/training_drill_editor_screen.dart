import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/navigation_fallback.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/models/whiteboard_data.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/services/training/training_plan_service.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/common/whiteboard/viro_whiteboard.dart';

/// Délai avant d'enregistrer l'exercice après une saisie.
const Duration _drillSaveDelay = Duration(milliseconds: 900);

/// Fiche d'un exercice : titre, durée, consignes et schéma. Modifiable dans
/// ma préparation, en lecture seule pour celle d'un collègue.
class TrainingDrillEditorScreen extends ConsumerStatefulWidget {
  const TrainingDrillEditorScreen({
    super.key,
    required this.clubId,
    required this.eventId,
    required this.coachUid,
    required this.drillId,
  });

  final String clubId;
  final String eventId;

  /// Coach propriétaire de la préparation.
  final String coachUid;
  final String drillId;

  @override
  ConsumerState<TrainingDrillEditorScreen> createState() =>
      _TrainingDrillEditorScreenState();
}

class _TrainingDrillEditorScreenState
    extends ConsumerState<TrainingDrillEditorScreen> {
  final _titleController = TextEditingController();
  final _durationController = TextEditingController();
  final _instructionsController = TextEditingController();
  TrainingDrill? _drill;
  Timer? _saveTimer;

  // Lu une fois : l'exercice peut s'écrire pendant dispose (ref interdit).
  late final TrainingPlanService _service = ref.read(
    trainingPlanServiceProvider,
  );

  TrainingCoachRef get _coachRef => (
    clubId: widget.clubId,
    eventId: widget.eventId,
    coachUid: widget.coachUid,
  );

  String get _fallback =>
      AppRoutes.clubTrainingPrepPath(widget.clubId, widget.eventId);

  @override
  void dispose() {
    if (_saveTimer?.isActive ?? false) {
      _saveTimer!.cancel();
      unawaited(_save());
    }
    _titleController.dispose();
    _durationController.dispose();
    _instructionsController.dispose();
    super.dispose();
  }

  /// Exercice édité avec la saisie courante.
  TrainingDrill? _edited() {
    final drill = _drill;
    if (drill == null) return null;
    final minutes = int.tryParse(_durationController.text.trim());
    return drill.copyWith(
      title: _titleController.text,
      instructions: _instructionsController.text,
      durationMin: minutes != null && minutes > 0 ? minutes : null,
      clearDuration: minutes == null || minutes <= 0,
    );
  }

  void _onChanged(String _) {
    _saveTimer?.cancel();
    _saveTimer = Timer(_drillSaveDelay, _save);
  }

  Future<void> _save() async {
    final drill = _edited();
    if (drill == null) return;
    try {
      await _service.saveDrill(
        clubId: widget.clubId,
        eventId: widget.eventId,
        coachUid: widget.coachUid,
        drill: drill,
      );
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.training.saveFailed);
    }
  }

  Future<void> _openBoard(int boardIndex) async {
    // Le schéma s'enregistre sur la version la plus récente de l'exercice.
    _saveTimer?.cancel();
    await _save();
    if (!mounted) return;
    context.push(
      AppRoutes.clubTrainingBoardPath(
        widget.clubId,
        widget.eventId,
        widget.coachUid,
        widget.drillId,
        boardIndex,
      ),
    );
  }

  Future<void> _addBoard() async {
    final drill = _drill;
    if (drill == null) return;
    if (drill.boards.length >= TrainingDrill.maxBoards) {
      ViroSnackBar.show(context, AppCopy.training.drillBoardLimit);
      return;
    }
    _saveTimer?.cancel();
    final next = drill.copyWith(
      boards: [...drill.boards, WhiteboardData.empty],
    );
    setState(() => _drill = next);
    try {
      await _service.saveDrill(
        clubId: widget.clubId,
        eventId: widget.eventId,
        coachUid: widget.coachUid,
        drill: _edited() ?? next,
      );
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.training.saveFailed);
      return;
    }
    if (!mounted) return;
    await _openBoard(next.boards.length - 1);
  }

  Future<void> _deleteBoard(int boardIndex) async {
    final drill = _drill;
    if (drill == null ||
        boardIndex < 0 ||
        boardIndex >= drill.boards.length) {
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(AppCopy.training.drillBoardDeleteTitle),
        content: Text(AppCopy.training.drillBoardDeleteBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(AppCopy.common.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: FilledButton.styleFrom(
              backgroundColor: ViroColors.error,
              foregroundColor: ViroColors.white,
            ),
            child: Text(AppCopy.training.drillBoardDeleteConfirm),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final boards = [...drill.boards]..removeAt(boardIndex);
    final next = drill.copyWith(boards: boards);
    setState(() => _drill = next);
    _saveTimer?.cancel();
    try {
      await _service.saveDrill(
        clubId: widget.clubId,
        eventId: widget.eventId,
        coachUid: widget.coachUid,
        drill: _edited() ?? next,
      );
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.training.saveFailed);
    }
  }

  Future<void> _delete(List<String> drillOrder) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(AppCopy.training.deleteDrillTitle),
        content: Text(AppCopy.training.deleteDrillBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(AppCopy.common.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: FilledButton.styleFrom(
              backgroundColor: ViroColors.error,
              foregroundColor: ViroColors.white,
            ),
            child: Text(AppCopy.training.deleteDrillConfirm),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    _saveTimer?.cancel();
    final event = ref
        .read(
          trainingEventProvider((
            clubId: widget.clubId,
            eventId: widget.eventId,
          )),
        )
        .value;
    try {
      await _service.deleteDrill(
        clubId: widget.clubId,
        eventId: widget.eventId,
        coachUid: widget.coachUid,
        drillId: widget.drillId,
      );
      if (event != null) {
        await _service.savePlan(
          clubId: widget.clubId,
          eventId: widget.eventId,
          coachUid: widget.coachUid,
          coachName:
              ref.read(clubMemberProvider(widget.clubId)).value?.fullName ?? '',
          teamIds: event.teamIds,
          drillOrder: drillOrder.where((id) => id != widget.drillId).toList(),
        );
      }
      _drill = null;
      if (mounted) popOrGo(context, _fallback);
    } catch (_) {
      if (mounted) ViroSnackBar.show(context, AppCopy.training.saveFailed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(trainingAuthUidProvider);
    final readOnly = uid != widget.coachUid;
    final drillsAsync = ref.watch(trainingDrillsProvider(_coachRef));
    final plan = ref.watch(trainingCoachPlanProvider(_coachRef));
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;

    final drill = drillsAsync.value
        ?.where((d) => d.id == widget.drillId)
        .firstOrNull;
    if (drill != null && _drill == null) {
      _drill = drill;
      _titleController.text = drill.title;
      _durationController.text = drill.durationMin?.toString() ?? '';
      _instructionsController.text = drill.instructions;
    } else if (drill != null) {
      // Schémas modifiés depuis le tableau blanc : garder la saisie en cours.
      _drill = _drill!.copyWith(boards: drill.boards);
    }

    return ViroScaffold(
      fallbackRoute: _fallback,
      appBar: ViroAppBar(
        fallbackRoute: _fallback,
        title: Text(AppCopy.training.drillTitle),
        actions: [
          if (!readOnly && drill != null)
            IconButton(
              tooltip: AppCopy.training.deleteDrill,
              icon: ViroIcon(ViroIcons.trash),
              onPressed: () => _delete(plan.drillOrder),
            ),
        ],
      ),
      body: drillsAsync.when(
        loading: () => const Center(child: ViroLogoLoader()),
        error: (_, _) => ViroErrorState(message: AppCopy.training.loadError),
        data: (_) {
          final current = _drill;
          if (current == null) {
            return ViroErrorState(message: AppCopy.training.loadError);
          }
          final ordered = plan.ordered(drillsAsync.value ?? const []);
          final drillPosition =
              ordered.indexWhere((d) => d.id == widget.drillId) + 1;
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.screenHorizontal,
              ViroSpacing.md,
              ViroSpacing.screenHorizontal,
              ViroSpacing.lg,
            ),
            children: [
              if (readOnly) ...[
                Text(
                  current.title.trim().isEmpty
                      ? AppCopy.training.untitledDrill(
                          drillPosition > 0 ? drillPosition : 1,
                        )
                      : current.title,
                  style: theme.titleMedium?.copyWith(
                    color: palette.brandText,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (current.durationMin != null)
                  Text(
                    AppCopy.training.drillDuration(current.durationMin!),
                    style: theme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                const SizedBox(height: ViroSpacing.md),
                if (current.instructions.trim().isNotEmpty)
                  Text(
                    current.instructions,
                    style: theme.bodyMedium?.copyWith(
                      color: palette.textPrimary,
                    ),
                  ),
              ] else ...[
                TextField(
                  controller: _titleController,
                  onChanged: _onChanged,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    labelText: AppCopy.training.drillNameLabel,
                    hintText: AppCopy.training.drillNameHint,
                  ),
                ),
                const SizedBox(height: ViroSpacing.md),
                TextField(
                  controller: _durationController,
                  onChanged: _onChanged,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(3),
                  ],
                  decoration: InputDecoration(
                    labelText: AppCopy.training.drillDurationLabel,
                  ),
                ),
                const SizedBox(height: ViroSpacing.md),
                TextField(
                  controller: _instructionsController,
                  onChanged: _onChanged,
                  minLines: 3,
                  maxLines: 12,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    labelText: AppCopy.training.drillInstructionsLabel,
                    hintText: AppCopy.training.drillInstructionsHint,
                    alignLabelWithHint: true,
                  ),
                ),
              ],
              const SizedBox(height: ViroSpacing.lg),
              Text(
                AppCopy.training.drillBoardLabel,
                style: theme.titleSmall?.copyWith(
                  color: palette.brandText,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: ViroSpacing.sm),
              if (!current.hasBoards)
                Text(
                  AppCopy.training.drillBoardEmpty,
                  style: theme.bodyMedium?.copyWith(color: palette.textMuted),
                )
              else
                _DrillBoardsGallery(
                  boards: current.boards,
                  readOnly: readOnly,
                  onOpen: _openBoard,
                  onDelete: _deleteBoard,
                ),
              if (!readOnly) ...[
                const SizedBox(height: ViroSpacing.sm),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: current.boards.length >= TrainingDrill.maxBoards
                        ? () => ViroSnackBar.show(
                              context,
                              AppCopy.training.drillBoardLimit,
                            )
                        : _addBoard,
                    icon: ViroIcon(ViroIcons.add, size: 18),
                    label: Text(AppCopy.training.drillBoardAdd),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

/// Galerie de miniatures des schémas d'un exercice.
class _DrillBoardsGallery extends StatelessWidget {
  const _DrillBoardsGallery({
    required this.boards,
    required this.readOnly,
    required this.onOpen,
    required this.onDelete,
  });

  final List<WhiteboardData> boards;
  final bool readOnly;
  final ValueChanged<int> onOpen;
  final ValueChanged<int> onDelete;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Wrap(
      spacing: ViroSpacing.sm,
      runSpacing: ViroSpacing.sm,
      children: [
        for (var i = 0; i < boards.length; i++)
          SizedBox(
            width: 148,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                ViroPressable(
                  label: AppCopy.training.boardSemantics,
                  onTap: readOnly ? null : () => onOpen(i),
                  floating: false,
                  child: WhiteboardThumbnail(data: boards[i]),
                ),
                if (!readOnly)
                  Positioned(
                    top: -6,
                    right: -6,
                    child: Material(
                      color: palette.surfaceCard,
                      shape: const CircleBorder(),
                      elevation: 1,
                      child: IconButton(
                        tooltip: AppCopy.training.drillBoardDelete,
                        visualDensity: VisualDensity.compact,
                        constraints: const BoxConstraints(
                          minWidth: ViroSpacing.minTouchTarget,
                          minHeight: ViroSpacing.minTouchTarget,
                        ),
                        onPressed: () => onDelete(i),
                        icon: ViroIcon(
                          ViroIcons.trash,
                          size: 18,
                          color: ViroColors.error,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
