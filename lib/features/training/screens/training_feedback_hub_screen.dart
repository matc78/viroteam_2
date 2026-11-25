import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/features/training/widgets/training_feedback_row_tile.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/services/training/training_feedback_inbox.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/club_chip.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/training_received_feedback_list_tile.dart';

/// Page « Feedback » (icône de l'en-tête de l'accueil), tous clubs
/// confondus : « Gestion » (coach ou admin : retours à faire, retours des
/// collègues, autres équipes) et « Pour moi » (retours reçus, moi ou mes
/// enfants, du plus récent au plus ancien). Le sélecteur n'apparaît que si
/// les deux parties existent.
class TrainingFeedbackHubScreen extends ConsumerStatefulWidget {
  const TrainingFeedbackHubScreen({super.key, this.initialTab});

  /// Partie ouverte au départ (sinon « Pour moi » s'il y a du neuf).
  final TrainingFeedbackHubTab? initialTab;

  @override
  ConsumerState<TrainingFeedbackHubScreen> createState() =>
      _TrainingFeedbackHubScreenState();
}

class _TrainingFeedbackHubScreenState
    extends ConsumerState<TrainingFeedbackHubScreen> {
  TrainingFeedbackHubTab? _tab;

  @override
  Widget build(BuildContext context) {
    final canManage = ref.watch(trainingFeedbackCanManageProvider);
    final canReceive = ref.watch(trainingFeedbackCanReceiveProvider);
    final unseen = ref.watch(unseenTrainingFeedbackCountProvider);
    final pending = ref.watch(pendingTrainingFeedbackTotalProvider);
    final requested =
        _tab ??
        widget.initialTab ??
        (unseen > 0 || !canManage
            ? TrainingFeedbackHubTab.mine
            : TrainingFeedbackHubTab.manage);
    final tab = switch (requested) {
      TrainingFeedbackHubTab.manage when !canManage =>
        TrainingFeedbackHubTab.mine,
      TrainingFeedbackHubTab.mine when !canReceive && canManage =>
        TrainingFeedbackHubTab.manage,
      _ => requested,
    };
    const fallback = AppRoutes.home;

    return ViroScaffold(
      fallbackRoute: fallback,
      appBar: ViroAppBar(
        fallbackRoute: fallback,
        title: Text(AppCopy.training.hubTitle),
      ),
      body: Column(
        children: [
          if (canManage && canReceive)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                ViroSpacing.screenHorizontal,
                ViroSpacing.sm,
                ViroSpacing.screenHorizontal,
                0,
              ),
              child: SizedBox(
                width: double.infinity,
                child: SegmentedButton<TrainingFeedbackHubTab>(
                  showSelectedIcon: false,
                  segments: [
                    ButtonSegment(
                      value: TrainingFeedbackHubTab.manage,
                      label: _TabLabel(
                        label: AppCopy.training.hubTabManage,
                        count: pending,
                      ),
                    ),
                    ButtonSegment(
                      value: TrainingFeedbackHubTab.mine,
                      label: _TabLabel(
                        label: AppCopy.training.hubTabMine,
                        count: unseen,
                      ),
                    ),
                  ],
                  selected: {tab},
                  onSelectionChanged: (selected) {
                    ViroHaptics.selection();
                    setState(() => _tab = selected.first);
                  },
                ),
              ),
            ),
          Expanded(
            child: AnimatedSwitcher(
              duration: ViroMotion.standard,
              child: tab == TrainingFeedbackHubTab.manage
                  ? _ManageTab(key: const ValueKey('manage'), pending: pending)
                  : _MineTab(key: const ValueKey('mine'), unseen: unseen),
            ),
          ),
        ],
      ),
    );
  }
}

/// Libellé d'onglet avec son compteur (pastille masquée à zéro).
class _TabLabel extends StatelessWidget {
  const _TabLabel({required this.label, required this.count});

  final String label;
  final int count;

  static const double _countMinWidth = 20;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label),
        if (count > 0) ...[
          const SizedBox(width: ViroSpacing.xs),
          Container(
            constraints: const BoxConstraints(minWidth: _countMinWidth),
            padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.xs),
            decoration: BoxDecoration(
              color: palette.accentFill,
              borderRadius: BorderRadius.circular(ViroSpacing.md),
            ),
            child: Text(
              '$count',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: palette.onAccent,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Bandeau d'en-tête d'une partie : pictogramme, phrase d'état, astuce.
class _HubIntro extends StatelessWidget {
  const _HubIntro({required this.icon, required this.title, this.hint});

  final IconData icon;
  final String title;
  final String? hint;

  static const double _iconBox = 44;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.md),
      child: ViroCard(
        elevated: false,
        padding: const EdgeInsets.all(ViroSpacing.md),
        child: Row(
          children: [
            Container(
              width: _iconBox,
              height: _iconBox,
              decoration: BoxDecoration(
                color: palette.accentSofter,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: ViroIcon(icon, size: 22, color: palette.accent),
            ),
            const SizedBox(width: ViroSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.titleSmall?.copyWith(
                      color: palette.brandText,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (hint != null) ...[
                    const SizedBox(height: ViroSpacing.xs / 2),
                    Text(
                      hint!,
                      style: theme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

const _listPadding = EdgeInsets.fromLTRB(
  ViroSpacing.screenHorizontal,
  ViroSpacing.md,
  ViroSpacing.screenHorizontal,
  ViroSpacing.xl,
);

/// Partie « Gestion » : mes séances (statut, flemme), retours des
/// collègues, autres équipes pour un admin.
class _ManageTab extends ConsumerWidget {
  const _ManageTab({super.key, required this.pending});

  final int pending;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entries = ref.watch(trainingFeedbackManageEntriesProvider);
    if (entries.isEmpty) {
      return ViroEmptyState(
        icon: ViroIcons.whistle,
        message: AppCopy.training.hubManageEmptyTitle,
        hint: AppCopy.training.hubManageEmptyHint,
      );
    }
    return ListView.builder(
      padding: _listPadding,
      itemCount: entries.length + 1,
      itemBuilder: (_, index) => index == 0
          ? _HubIntro(
              icon: ViroIcons.whistle,
              title: AppCopy.training.hubManageIntro(pending),
              hint: AppCopy.training.hubManageHint(
                pendingTrainingFeedbackWindowDays,
              ),
            )
          : _ManageEntryView(entry: entries[index - 1]),
    );
  }
}

/// Un élément de « Gestion » : intertitre, ligne ou lien « tout voir ».
class _ManageEntryView extends ConsumerWidget {
  const _ManageEntryView({required this.entry});

  final TrainingFeedbackManageEntry entry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    return switch (entry) {
      TrainingFeedbackManageHeader(:final clubId, :final clubName) => Padding(
        padding: const EdgeInsets.only(
          top: ViroSpacing.sm,
          bottom: ViroSpacing.sm,
        ),
        child: Align(
          alignment: Alignment.centerLeft,
          child: clubName != null
              ? ClubChip(
                  label: clubName,
                  color: ref.watch(clubMemberAccentProvider(clubId)),
                )
              : Text(
                  AppCopy.training.hubOtherTeams,
                  style: theme.labelLarge?.copyWith(
                    color: palette.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
        ),
      ),
      TrainingFeedbackManageRowEntry(:final clubId, :final row) =>
        TrainingFeedbackRowTile(clubId: clubId, row: row),
      TrainingFeedbackManageSeeAll(:final clubId) => Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          onPressed: () =>
              context.push(AppRoutes.clubTrainingFeedbackListPath(clubId)),
          icon: ViroIcon(ViroIcons.chevronRight, size: 16),
          label: Text(AppCopy.training.hubSeeAll),
        ),
      ),
    };
  }
}

/// Partie « Pour moi » : retours reçus, du plus récent au plus ancien.
class _MineTab extends ConsumerWidget {
  const _MineTab({super.key, required this.unseen});

  final int unseen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(allReceivedTrainingFeedbackProvider);
    if (items.isEmpty) {
      return ViroEmptyState(
        icon: ViroIcons.feedback,
        message: AppCopy.training.hubMineEmptyTitle,
        hint: AppCopy.training.hubMineEmptyHint,
      );
    }
    final multiClub = ref.watch(trainingFeedbackHubClubsProvider).length > 1;
    return ListView.builder(
      padding: _listPadding,
      itemCount: items.length + 1,
      itemBuilder: (_, index) => index == 0
          ? _HubIntro(
              icon: ViroIcons.feedback,
              title: AppCopy.training.hubMineIntro(unseen),
            )
          : _ReceivedEntryView(item: items[index - 1], showClub: multiClub),
    );
  }
}

/// Retour reçu → tuile (équipe, noms des coachs, club si plusieurs).
class _ReceivedEntryView extends ConsumerWidget {
  const _ReceivedEntryView({required this.item, required this.showClub});

  final TrainingFeedbackInboxItem item;
  final bool showClub;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final event = item.event;
    final clubId = event.clubId;
    final teamsById = <String, ClubTeam>{
      for (final team in ref.watch(clubTeamsProvider(clubId)).value ?? const [])
        team.id: team,
    };
    final membersById = ref.watch(trainingMembersByIdProvider(clubId));
    final coaches = AppCopy.training.receivedCoaches([
      for (final uid in item.coachUids) membersById[uid]?.fullName ?? '',
    ], item.coachUids.length);
    final title = PlanningEventDisplay.calendarTitle(event);
    final teamLabel = PlanningEventDisplay.teamLabel(event, teamsById);
    final subtitle = [if (teamLabel != title) ?teamLabel, coaches].join(' · ');
    final clubName = showClub
        ? ref
              .watch(trainingFeedbackHubClubsProvider)
              .where((club) => club.clubId == clubId)
              .map((club) => club.clubName)
              .firstOrNull
        : null;

    return TrainingReceivedFeedbackListTile(
      weekdayLabel: formatWeekdayShort(event.date),
      dayLabel: '${event.date.day}',
      monthLabel: formatMonthShort(event.date),
      dateSemantics: formatEventDate(event.date),
      title: title,
      subtitle: subtitle,
      isNew: item.isUnseen,
      childFirstName: item.childFirstName,
      clubName: clubName,
      clubColor: clubName == null
          ? null
          : ref.watch(clubMemberAccentProvider(clubId)),
      onTap: () => context.push(
        AppRoutes.clubTrainingFeedbackReceivedPath(
          clubId,
          event.id,
          memberId: item.memberId,
        ),
      ),
    );
  }
}
