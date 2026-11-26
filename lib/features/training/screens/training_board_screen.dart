import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/navigation_fallback.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/models/whiteboard_data.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/common/whiteboard/viro_whiteboard.dart';

/// Tableau blanc d'un schéma d'exercice : crayon, flèche, jetons joueur /
/// adversaire / ballon à déplacer, annuler, tout effacer. « Valider »
/// enregistre le schéma à l'index [boardIndex] de l'exercice.
class TrainingBoardScreen extends ConsumerStatefulWidget {
  const TrainingBoardScreen({
    super.key,
    required this.clubId,
    required this.eventId,
    required this.coachUid,
    required this.drillId,
    required this.boardIndex,
  });

  final String clubId;
  final String eventId;
  final String coachUid;
  final String drillId;

  /// Index dans `TrainingDrill.boards`.
  final int boardIndex;

  @override
  ConsumerState<TrainingBoardScreen> createState() =>
      _TrainingBoardScreenState();
}

class _TrainingBoardScreenState extends ConsumerState<TrainingBoardScreen> {
  TrainingDrill? _drill;
  WhiteboardData _board = WhiteboardData.empty;
  final List<WhiteboardData> _history = [];
  WhiteboardTool _tool = WhiteboardTool.pen;
  WhiteboardInk _ink = WhiteboardInk.accent;
  bool _saving = false;

  String get _fallback => AppRoutes.clubTrainingDrillPath(
    widget.clubId,
    widget.eventId,
    widget.coachUid,
    widget.drillId,
  );

  /// Nouvel état du schéma (un trait, un jeton posé ou déplacé), l'ancien
  /// part dans l'historique (annuler).
  void _apply(WhiteboardData next) {
    setState(() {
      _history.add(_board);
      _board = next;
    });
  }

  void _addToken(WhiteboardTokenKind kind) {
    if (_board.tokens.length >= WhiteboardData.maxTokens) {
      ViroSnackBar.show(context, AppCopy.training.boardLimitReached);
      return;
    }
    final sameKind = _board.tokens.where((t) => t.kind == kind).length;
    final label = kind == WhiteboardTokenKind.ball ? '' : '${sameKind + 1}';
    // Posé au centre, décalé pour ne pas empiler les jetons.
    final offset = (sameKind % 6) * 0.06;
    final token = WhiteboardToken(
      kind: kind,
      label: label,
      position: WhiteboardPoint(
        0.3 + offset,
        kind == WhiteboardTokenKind.opponent ? 0.3 : 0.7,
      ),
    );
    _apply(_board.copyWith(tokens: [..._board.tokens, token]));
    setState(() => _tool = WhiteboardTool.move);
  }

  void _undo() {
    if (_history.isEmpty) return;
    setState(() => _board = _history.removeLast());
  }

  Future<void> _clear() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(AppCopy.training.boardClearTitle),
        content: Text(AppCopy.training.boardClearBody),
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
            child: Text(AppCopy.training.boardClearConfirm),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      _apply(_board.copyWith(strokes: const [], tokens: const []));
    }
  }

  Future<void> _save() async {
    if (_drill == null) return;
    final index = widget.boardIndex;
    setState(() => _saving = true);
    try {
      // Snapshot le plus récent : évite d'écraser titre / autres schémas
      // modifiés pendant que ce tableau était ouvert.
      final latest =
          ref
              .read(
                trainingDrillsProvider((
                  clubId: widget.clubId,
                  eventId: widget.eventId,
                  coachUid: widget.coachUid,
                )),
              )
              .value
              ?.where((d) => d.id == widget.drillId)
              .firstOrNull ??
          _drill!;
      if (index < 0 || index >= latest.boards.length) {
        if (mounted) {
          setState(() => _saving = false);
          ViroSnackBar.show(context, AppCopy.training.saveFailed);
        }
        return;
      }
      final boards = [...latest.boards];
      boards[index] = _board;
      await ref
          .read(trainingPlanServiceProvider)
          .saveDrill(
            clubId: widget.clubId,
            eventId: widget.eventId,
            coachUid: widget.coachUid,
            drill: latest.copyWith(boards: boards),
          );
      if (mounted) popOrGo(context, _fallback);
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      ViroSnackBar.show(context, AppCopy.training.saveFailed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(trainingAuthUidProvider);
    final drillsAsync = ref.watch(
      trainingDrillsProvider((
        clubId: widget.clubId,
        eventId: widget.eventId,
        coachUid: widget.coachUid,
      )),
    );
    final drill = drillsAsync.value
        ?.where((d) => d.id == widget.drillId)
        .firstOrNull;
    if (drill != null && _drill == null) {
      _drill = drill;
      final index = widget.boardIndex;
      if (index >= 0 && index < drill.boards.length) {
        _board = drill.boards[index];
      }
    }

    return ViroScaffold(
      fallbackRoute: _fallback,
      appBar: ViroAppBar(
        fallbackRoute: _fallback,
        title: Text(AppCopy.training.boardTitle),
        actions: [
          TextButton(
            onPressed: _saving || _drill == null || uid != widget.coachUid
                ? null
                : _save,
            child: Text(AppCopy.training.boardDone),
          ),
        ],
      ),
      body: drillsAsync.when(
        loading: () => const Center(child: ViroLogoLoader()),
        error: (_, _) => ViroErrorState(message: AppCopy.training.loadError),
        data: (_) {
          final drill = _drill;
          final indexOk = drill != null &&
              widget.boardIndex >= 0 &&
              widget.boardIndex < drill.boards.length;
          if (drill == null || uid != widget.coachUid || !indexOk) {
            return ViroErrorState(message: AppCopy.training.loadError);
          }
          return SafeArea(
            top: false,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    ViroSpacing.screenHorizontal,
                    ViroSpacing.sm,
                    ViroSpacing.screenHorizontal,
                    0,
                  ),
                  child: _CourtPicker(
                    court: _board.court,
                    onChanged: (court) => _apply(_board.copyWith(court: court)),
                  ),
                ),
                Expanded(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(ViroSpacing.md),
                      child: ViroWhiteboard(
                        data: _board,
                        tool: _tool,
                        ink: _ink,
                        onChanged: _apply,
                        onLimitReached: () => ViroSnackBar.show(
                          context,
                          AppCopy.training.boardLimitReached,
                        ),
                      ),
                    ),
                  ),
                ),
                _BoardToolbar(
                  tool: _tool,
                  ink: _ink,
                  canUndo: _history.isNotEmpty,
                  canClear: !_board.isEmpty,
                  onTool: (tool) => setState(() => _tool = tool),
                  onInk: (ink) => setState(() => _ink = ink),
                  onAddToken: _addToken,
                  onUndo: _undo,
                  onClear: _clear,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Choix du fond : terrain entier, demi-terrain ou tableau blanc.
class _CourtPicker extends StatelessWidget {
  const _CourtPicker({required this.court, required this.onChanged});

  final WhiteboardCourt court;
  final ValueChanged<WhiteboardCourt> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: SegmentedButton<WhiteboardCourt>(
        showSelectedIcon: false,
        segments: [
          ButtonSegment(
            value: WhiteboardCourt.full,
            label: Text(AppCopy.training.boardCourtFull),
          ),
          ButtonSegment(
            value: WhiteboardCourt.half,
            label: Text(AppCopy.training.boardCourtHalf),
          ),
          ButtonSegment(
            value: WhiteboardCourt.blank,
            label: Text(AppCopy.training.boardCourtBlank),
          ),
        ],
        selected: {court},
        onSelectionChanged: (selected) {
          ViroHaptics.selection();
          onChanged(selected.first);
        },
      ),
    );
  }
}

/// Barre d'outils du tableau : outils, encres, jetons, annuler, effacer.
class _BoardToolbar extends StatelessWidget {
  const _BoardToolbar({
    required this.tool,
    required this.ink,
    required this.canUndo,
    required this.canClear,
    required this.onTool,
    required this.onInk,
    required this.onAddToken,
    required this.onUndo,
    required this.onClear,
  });

  final WhiteboardTool tool;
  final WhiteboardInk ink;
  final bool canUndo;
  final bool canClear;
  final ValueChanged<WhiteboardTool> onTool;
  final ValueChanged<WhiteboardInk> onInk;
  final ValueChanged<WhiteboardTokenKind> onAddToken;
  final VoidCallback onUndo;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    Widget toolButton(WhiteboardTool value, IconData icon, String tooltip) =>
        IconButton(
          tooltip: tooltip,
          isSelected: tool == value,
          onPressed: () => onTool(value),
          icon: ViroIcon(
            icon,
            color: tool == value ? palette.accent : palette.textSecondary,
          ),
          style: IconButton.styleFrom(
            backgroundColor: tool == value ? palette.accentSoft : null,
          ),
        );
    Widget inkButton(WhiteboardInk value, Color color, String tooltip) =>
        IconButton(
          tooltip: tooltip,
          isSelected: ink == value,
          onPressed: () {
            onInk(value);
            if (tool == WhiteboardTool.move) onTool(WhiteboardTool.pen);
          },
          icon: Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(
                color: ink == value ? palette.textPrimary : palette.border,
                width: ink == value ? 3 : 1,
              ),
            ),
          ),
        );

    return Material(
      color: palette.surfaceCard,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.sm,
          vertical: ViroSpacing.xs,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Wrap(
              alignment: WrapAlignment.center,
              children: [
                toolButton(
                  WhiteboardTool.pen,
                  ViroIcons.edit,
                  AppCopy.training.boardPen,
                ),
                toolButton(
                  WhiteboardTool.arrow,
                  ViroIcons.boardArrow,
                  AppCopy.training.boardArrow,
                ),
                toolButton(
                  WhiteboardTool.move,
                  ViroIcons.boardMove,
                  AppCopy.training.boardMove,
                ),
                inkButton(
                  WhiteboardInk.accent,
                  palette.accent,
                  AppCopy.training.boardInkAccent,
                ),
                inkButton(
                  WhiteboardInk.red,
                  ViroColors.error,
                  AppCopy.training.boardInkRed,
                ),
                inkButton(
                  WhiteboardInk.dark,
                  palette.textPrimary,
                  AppCopy.training.boardInkDark,
                ),
              ],
            ),
            Wrap(
              alignment: WrapAlignment.center,
              children: [
                IconButton(
                  tooltip: AppCopy.training.boardPlayer,
                  onPressed: () => onAddToken(WhiteboardTokenKind.player),
                  icon: ViroIcon(ViroIcons.userPlus, color: palette.accent),
                ),
                IconButton(
                  tooltip: AppCopy.training.boardOpponent,
                  onPressed: () => onAddToken(WhiteboardTokenKind.opponent),
                  icon: ViroIcon(ViroIcons.userPlus, color: ViroColors.error),
                ),
                IconButton(
                  tooltip: AppCopy.training.boardBall,
                  onPressed: () => onAddToken(WhiteboardTokenKind.ball),
                  icon: ViroIcon(
                    ViroIcons.boardBall,
                    color: palette.textSecondary,
                  ),
                ),
                IconButton(
                  tooltip: AppCopy.training.boardUndo,
                  onPressed: canUndo ? onUndo : null,
                  icon: ViroIcon(ViroIcons.undo),
                ),
                IconButton(
                  tooltip: AppCopy.training.boardClear,
                  onPressed: canClear ? onClear : null,
                  icon: ViroIcon(ViroIcons.eraser),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
