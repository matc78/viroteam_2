import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/training_plan.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/training_library_drill_list_tile.dart';
import 'package:viro_team_v2/widgets/lists/training_library_session_list_tile.dart';

/// Onglets de la bibliothèque.
enum _LibraryTab { sessions, drills }

/// Bibliothèque d'une séance : préparations passées (6 mois) de mes équipes,
/// les miennes et celles des collègues ; dupliquer une séance entière
/// (exercices + notes si les miennes sont vides) ou ajouter un exercice à ma
/// préparation de la séance [eventId]. Même contenu que sur le portail.
class TrainingLibraryScreen extends ConsumerStatefulWidget {
  const TrainingLibraryScreen({
    super.key,
    required this.clubId,
    required this.eventId,
  });

  final String clubId;
  final String eventId;

  @override
  ConsumerState<TrainingLibraryScreen> createState() =>
      _TrainingLibraryScreenState();
}

class _TrainingLibraryScreenState extends ConsumerState<TrainingLibraryScreen> {
  _LibraryTab _tab = _LibraryTab.sessions;
  String _search = '';

  /// Clés des séances dupliquées / exercices ajoutés pendant la visite.
  final Set<String> _added = {};

  /// Copie [drills] (et [notes] si les miennes sont vides) dans ma préparation.
  Future<void> _copy({
    required ClubEvent event,
    required String uid,
    required String key,
    required List<TrainingDrill> drills,
    String? notes,
  }) async {
    final myRef = (
      clubId: widget.clubId,
      eventId: widget.eventId,
      coachUid: uid,
    );
    final plan = ref.read(trainingCoachPlanProvider(myRef));
    final current = ref.read(trainingOrderedDrillsProvider(myRef)).value;
    // Ma préparation pas encore lue : ne pas réécrire un ordre incomplet.
    if (current == null ||
        !ref
            .read(
              trainingPlansProvider((
                clubId: widget.clubId,
                eventId: widget.eventId,
              )),
            )
            .hasValue) {
      ViroSnackBar.show(context, AppCopy.training.saveFailed);
      return;
    }
    setState(() => _added.add(key));
    try {
      final copies = await ref
          .read(trainingPlanServiceProvider)
          .copyDrillsInto(
            clubId: widget.clubId,
            eventId: widget.eventId,
            coachUid: uid,
            coachName:
                ref.read(clubMemberProvider(widget.clubId)).value?.fullName ??
                '',
            teamIds: event.teamIds,
            existingOrder: [for (final drill in current) drill.id],
            drills: drills,
            currentNotes: plan.notes,
            importedNotes: notes,
          );
      if (!mounted) return;
      ViroHaptics.success();
      ViroSnackBar.show(
        context,
        copies.isEmpty
            ? AppCopy.training.saved
            : AppCopy.training.drillsCopied(copies.length),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _added.remove(key));
      ViroSnackBar.show(context, AppCopy.training.saveFailed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final eventRef = (clubId: widget.clubId, eventId: widget.eventId);
    final eventAsync = ref.watch(trainingEventProvider(eventRef));
    final uid = ref.watch(trainingAuthUidProvider);
    final access = ref.watch(clubAccessProvider(widget.clubId));
    final fallback = AppRoutes.clubTrainingPrepPath(
      widget.clubId,
      widget.eventId,
    );

    return ViroScaffold(
      fallbackRoute: fallback,
      appBar: ViroAppBar(
        fallbackRoute: fallback,
        title: Text(AppCopy.training.libraryTitle),
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
          return _buildContent(event, uid);
        },
      ),
    );
  }

  Widget _buildContent(ClubEvent event, String uid) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    // Garde ma préparation à jour (ordre et notes) pour les copies.
    ref.watch(
      trainingOrderedDrillsProvider((
        clubId: widget.clubId,
        eventId: widget.eventId,
        coachUid: uid,
      )),
    );
    final viewAsync = ref.watch(
      trainingLibraryViewProvider((
        clubId: widget.clubId,
        eventId: widget.eventId,
        query: _search,
      )),
    );
    const padding = EdgeInsets.fromLTRB(
      ViroSpacing.screenHorizontal,
      ViroSpacing.sm,
      ViroSpacing.screenHorizontal,
      ViroSpacing.lg,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            ViroSpacing.screenHorizontal,
            ViroSpacing.md,
            ViroSpacing.screenHorizontal,
            0,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                AppCopy.training.libraryIntro,
                style: theme.bodySmall?.copyWith(color: palette.textSecondary),
              ),
              const SizedBox(height: ViroSpacing.sm),
              SegmentedButton<_LibraryTab>(
                showSelectedIcon: false,
                segments: [
                  ButtonSegment(
                    value: _LibraryTab.sessions,
                    label: Text(AppCopy.training.libraryTabSessions),
                  ),
                  ButtonSegment(
                    value: _LibraryTab.drills,
                    label: Text(AppCopy.training.libraryTabDrills),
                  ),
                ],
                selected: {_tab},
                onSelectionChanged: (selected) {
                  ViroHaptics.selection();
                  setState(() => _tab = selected.first);
                },
              ),
              const SizedBox(height: ViroSpacing.sm),
              TextField(
                onChanged: (value) => setState(() => _search = value),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: AppCopy.training.librarySearchHint,
                  prefixIcon: ViroIcon(ViroIcons.search),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: viewAsync.when(
            loading: () => const Center(child: ViroLogoLoader()),
            error: (_, _) =>
                ViroErrorState(message: AppCopy.training.libraryLoadError),
            data: (view) {
              final searching = _search.trim().isNotEmpty;
              if (_tab == _LibraryTab.sessions) {
                if (view.sessions.isEmpty) {
                  return ViroEmptyState(
                    icon: ViroIcons.library,
                    message: searching
                        ? AppCopy.training.libraryNoMatch
                        : AppCopy.training.libraryEmptySessions,
                  );
                }
                return ListView.builder(
                  padding: padding,
                  itemCount: view.sessions.length,
                  itemBuilder: (_, i) => TrainingLibrarySessionListTile(
                    session: view.sessions[i].session,
                    teamsLabel: view.sessions[i].teamsLabel,
                    duplicated: _added.contains(view.sessions[i].session.key),
                    onOpen: () => context.push(
                      AppRoutes.clubTrainingPrepPath(
                        widget.clubId,
                        view.sessions[i].session.event.id,
                      ),
                    ),
                    onDuplicate: () => _copy(
                      event: event,
                      uid: uid,
                      key: view.sessions[i].session.key,
                      drills: view.sessions[i].session.drills,
                      notes: view.sessions[i].session.notes,
                    ),
                  ),
                );
              }
              if (view.drills.isEmpty) {
                return ViroEmptyState(
                  icon: ViroIcons.library,
                  message: searching
                      ? AppCopy.training.libraryNoMatch
                      : AppCopy.training.libraryEmptyDrills,
                );
              }
              return ListView.builder(
                padding: padding,
                itemCount: view.drills.length,
                itemBuilder: (_, i) => TrainingLibraryDrillListTile(
                  row: view.drills[i],
                  added: _added.contains(view.drills[i].key),
                  onAdd: () => _copy(
                    event: event,
                    uid: uid,
                    key: view.drills[i].key,
                    drills: [view.drills[i].drill],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
