import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/features/training/widgets/training_feedback_row_tile.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// « Feedback entraînement » d'un club : tous mes entraînements passés,
/// paginés, du plus récent au plus ancien, chacun suivi des retours déjà
/// envoyés par les autres coachs. Un tap ouvre la saisie (ou le retour du
/// collègue) ; un appui long bascule la « flemme ».
class TrainingFeedbackListScreen extends ConsumerStatefulWidget {
  const TrainingFeedbackListScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<TrainingFeedbackListScreen> createState() =>
      _TrainingFeedbackListScreenState();
}

class _TrainingFeedbackListScreenState
    extends ConsumerState<TrainingFeedbackListScreen> {
  int _limit = pastTrainingsPageSize;

  @override
  Widget build(BuildContext context) {
    final pastRef = (clubId: widget.clubId, limit: _limit);
    final rowsAsync = ref.watch(trainingFeedbackListRowsProvider(pastRef));
    final eventCount =
        ref.watch(pastTrainingsProvider(pastRef)).value?.length ?? 0;
    const fallback = AppRoutes.trainingFeedbackHub;

    return ViroScaffold(
      fallbackRoute: fallback,
      appBar: ViroAppBar(
        fallbackRoute: fallback,
        title: Text(AppCopy.training.listTitle),
      ),
      body: rowsAsync.when(
        loading: () => const Center(child: ViroLogoLoader()),
        error: (_, _) => ViroErrorState(
          message: AppCopy.training.listLoadError,
          onRetry: () => ref.invalidate(pastTrainingsProvider),
        ),
        data: (rows) {
          if (rows.isEmpty) {
            return ViroEmptyState(
              icon: ViroIcons.whistle,
              message: AppCopy.training.listEmptyTitle,
              hint: AppCopy.training.listEmptyHint,
            );
          }
          final canLoadMore = eventCount >= _limit;
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.screenHorizontal,
              ViroSpacing.md,
              ViroSpacing.screenHorizontal,
              ViroSpacing.lg,
            ),
            itemCount: rows.length + (canLoadMore ? 1 : 0),
            itemBuilder: (_, index) => index == rows.length
                ? TextButton(
                    onPressed: () =>
                        setState(() => _limit += pastTrainingsPageSize),
                    child: Text(AppCopy.training.loadMore),
                  )
                : TrainingFeedbackRowTile(
                    clubId: widget.clubId,
                    row: rows[index],
                  ),
          );
        },
      ),
    );
  }
}
