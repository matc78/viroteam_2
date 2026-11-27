import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/feature_flags.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/members/widgets/member_detail_sheet.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
import 'package:viro_team_v2/features/planning/utils/planning_rsvp_badge.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_member_rsvp_row.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_rsvp_badge.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/open_address_sheet.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_status_toast.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_convocation_sheet.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_edit_event_sheet.dart';
import 'package:viro_team_v2/widgets/common/viro_logo_loader.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/models/club_access.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';
import 'package:viro_team_v2/services/event/event_date_helpers.dart';

enum _CancelScope { single, series }

class PlanningEventDetailSheet extends ConsumerStatefulWidget {
  const PlanningEventDetailSheet({
    super.key,
    required this.clubId,
    required this.event,
    required this.scrollController,
    this.teamLabel,
    this.excludeCoachUids = const {},
    required this.onCanceled,
    required this.rsvpAudience,
    this.onRsvpUpdated,
  });

  final String clubId;
  final ClubEvent event;
  final ScrollController scrollController;
  final String? teamLabel;
  final Set<String> excludeCoachUids;
  final VoidCallback onCanceled;

  /// Notifie l'écran parent après un RSVP (invalidation des listes).
  final VoidCallback? onRsvpUpdated;

  /// Pour qui la feuille répond, fixé par l'appelant selon la liste d'où
  /// vient l'événement : [RsvpAudience.self] depuis l'accueil / le planning
  /// perso (événements de l'uid connecté), [RsvpAudience.selectedAudience]
  /// depuis le planning du club (cible Moi | enfant sélectionnée).
  final RsvpAudience rsvpAudience;

  /// Ouvre la feuille de détail de [event] ; [rsvpAudience] : voir le champ.
  static Future<void> show({
    required BuildContext context,
    required String clubId,
    required ClubEvent event,
    String? teamLabel,
    Set<String> excludeCoachUids = const {},
    required VoidCallback onCanceled,
    required RsvpAudience rsvpAudience,
    VoidCallback? onRsvpUpdated,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      isDismissible: true,
      enableDrag: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => Consumer(
        builder: (context, sheetRef, _) {
          // Watch (pas read) : l'accent se met à jour si le club charge après
          // l'ouverture (cold start) — évite de figer un fallback rouge.
          final accent = sheetRef.watch(clubMemberAccentProvider(clubId));
          return ClubAccentTheme(
            accentColor: accent,
            child: DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.65,
              minChildSize: 0.4,
              maxChildSize: 0.9,
              builder: (_, scrollController) => PlanningEventDetailSheet(
                clubId: clubId,
                event: event,
                scrollController: scrollController,
                teamLabel: teamLabel,
                excludeCoachUids: excludeCoachUids,
                onCanceled: onCanceled,
                rsvpAudience: rsvpAudience,
                onRsvpUpdated: onRsvpUpdated,
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  ConsumerState<PlanningEventDetailSheet> createState() =>
      _PlanningEventDetailSheetState();
}

class _PlanningEventDetailSheetState
    extends ConsumerState<PlanningEventDetailSheet> {
  bool _sendingPush = false;
  late ClubEvent _event;

  @override
  void initState() {
    super.initState();
    _event = widget.event;
  }

  IconData get _typeIcon => switch (_event.type) {
        EventTypes.training => ViroIcons.whistle,
        EventTypes.match => ViroIcons.ball,
        EventTypes.tournament => ViroIcons.trophy,
        EventTypes.meeting => ViroIcons.groups,
        _ => ViroIcons.calendar,
      };

  /// Événement du jour ou passé (retour de séance possible).
  bool get _isDayOrPast {
    if (_event.canceled) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final eventDay = DateTime(
      _event.date.year,
      _event.date.month,
      _event.date.day,
    );
    return !eventDay.isAfter(today);
  }

  /// Droits du compte connecté (fiche + réglages coach du club).
  ClubAccess get _access => ref.watch(clubAccessProvider(widget.clubId));

  /// Modifier / annuler l'événement : droit planning, ou coach de **toutes**
  /// ses équipes avec le réglage `canCreateEvents` (jamais « tout le club »).
  bool get _canManageEvent =>
      _access.canManageEvent(_event.teamIds, allTeams: _event.allTeams);

  /// Convocations et notification : droit planning ou coach de toutes les
  /// équipes de l'événement.
  bool get _canManageAudience => _access.canManageEventAudience(
    _event.teamIds,
    allTeams: _event.allTeams,
  );

  /// Outils d'entraînement actifs sur cet événement (entraînement non annulé).
  bool get _isTrainingWithTools =>
      (FeatureFlags.trainingPrepLive || FeatureFlags.trainingFeedbackLive) &&
      _event.type == EventTypes.training &&
      !_event.canceled;

  /// Retours de séance (dormants tant que le flag est coupé).
  bool get _feedbackLive => FeatureFlags.trainingFeedbackLive;

  /// Coach d'une équipe de la séance : préparation et retour.
  bool get _canCoachTraining =>
      _isTrainingWithTools &&
      _access.canCoachTraining(_event.teamIds, allTeams: _event.allTeams);

  /// Coachs de la séance et admin : consultation des retours envoyés.
  bool get _canReviewTraining =>
      _isTrainingWithTools &&
      _access.canReviewTraining(_event.teamIds, allTeams: _event.allTeams);

  /// Colonne gauche : Modifier / Convoqués.
  List<_EventDetailAction> _staffActionsLeft() {
    return [
      if (_canEditEvent)
        _EventDetailAction(
          icon: ViroIcons.edit,
          label: AppCopy.planning.editEventActionShort,
          onPressed: _openEditEvent,
        ),
      if (_canManageConvocations)
        _EventDetailAction(
          icon: ViroIcons.users,
          label: AppCopy.planning.manageConvocationsShort,
          onPressed: _openConvocations,
        ),
    ];
  }

  /// Colonne droite : Notifier / prépa / retours. [rsvpMemberId] pour le
  /// retour reçu (soi ou enfant).
  List<_EventDetailAction> _staffActionsRight({String? rsvpMemberId}) {
    final actions = <_EventDetailAction>[];

    if (_canManageAudience) {
      actions.add(
        _EventDetailAction(
          icon: ViroIcons.bell,
          label: _sendingPush
              ? AppCopy.planning.sending
              : AppCopy.planning.sendNotificationShort,
          onPressed: _sendingPush ? null : _sendEventPush,
          primary: true,
          busy: _sendingPush,
        ),
      );
    }

    if (!_isTrainingWithTools) return actions;

    final uid = ref.watch(trainingAuthUidProvider);
    final event = _event;
    final started = _isDayOrPast;
    // Le jour J : préparation et retour tous deux possibles.
    final preparable =
        !started ||
        EventDateHelpers.sameCalendarDay(event.date, DateTime.now());
    final anyFeedbackSent = event.trainingFeedbackSentBy.isNotEmpty;

    if (FeatureFlags.trainingPrepLive && _canCoachTraining && preparable) {
      final plans =
          ref
              .watch(
                trainingPlansProvider((
                  clubId: widget.clubId,
                  eventId: event.id,
                )),
              )
              .value ??
          const [];
      final hasPlan = plans.any((plan) => plan.coachUid == uid);
      actions.add(
        _EventDetailAction(
          icon: ViroIcons.trainingPrep,
          label: hasPlan
              ? AppCopy.training.myPrepAction
              : AppCopy.training.prepareActionShort,
          onPressed: () => _openTrainingScreen(
            AppRoutes.clubTrainingPrepPath(widget.clubId, event.id),
          ),
        ),
      );
    }
    if (_feedbackLive && _canCoachTraining && started) {
      final sent = uid != null && event.trainingFeedbackSentByCoach(uid);
      actions.add(
        _EventDetailAction(
          icon: sent ? ViroIcons.checkCircle : ViroIcons.feedback,
          label: sent
              ? AppCopy.training.feedbackSentAction
              : AppCopy.training.feedbackAction,
          onPressed: () => _openTrainingScreen(
            AppRoutes.clubTrainingFeedbackPath(widget.clubId, event.id),
          ),
        ),
      );
    }
    if (_feedbackLive && _canReviewTraining && started && anyFeedbackSent) {
      actions.add(
        _EventDetailAction(
          icon: ViroIcons.eye,
          label: AppCopy.training.reviewAction,
          onPressed: () => _openTrainingScreen(
            AppRoutes.clubTrainingFeedbackReviewPath(
              widget.clubId,
              event.id,
            ),
          ),
        ),
      );
    }
    if (_feedbackLive &&
        !_canCoachTraining &&
        started &&
        anyFeedbackSent &&
        rsvpMemberId != null &&
        event.isInvitedAsPlayer(rsvpMemberId)) {
      actions.add(
        _EventDetailAction(
          icon: ViroIcons.feedback,
          label: AppCopy.training.reviewReceivedAction,
          onPressed: () => _openTrainingScreen(
            AppRoutes.clubTrainingFeedbackReceivedPath(
              widget.clubId,
              event.id,
              memberId: rsvpMemberId,
            ),
          ),
        ),
      );
    }

    return actions;
  }

  /// Colonne verticale d'actions, espacées de [ViroSpacing.xs].
  Widget _staffActionColumn(List<_EventDetailAction> actions) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var index = 0; index < actions.length; index++) ...[
          if (index > 0) const SizedBox(height: ViroSpacing.xs),
          _EventDetailActionButton(action: actions[index]),
        ],
      ],
    );
  }

  /// Grille 2 colonnes : gauche Modifier / Convoqués, droite Notifier / prépa.
  Widget _buildStaffActionsGrid({String? rsvpMemberId}) {
    final left = _staffActionsLeft();
    final right = _staffActionsRight(rsvpMemberId: rsvpMemberId);
    if (left.isEmpty && right.isEmpty) return const SizedBox.shrink();

    final Widget body;
    if (left.isEmpty) {
      body = _staffActionColumn(right);
    } else if (right.isEmpty) {
      body = _staffActionColumn(left);
    } else {
      body = Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: _staffActionColumn(left)),
          const SizedBox(width: ViroSpacing.sm),
          Expanded(child: _staffActionColumn(right)),
        ],
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: ViroSpacing.sm),
      child: body,
    );
  }

  /// Ouvre [location] (écran d'entraînement) en fermant la feuille.
  void _openTrainingScreen(String location) {
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.push(location);
  }

  /// Droit planning (ou coach d'une équipe avec `canEditMemberRsvp`) :
  /// éditer le RSVP d’un convoqué.
  bool get _canEditMemberRsvp =>
      !_event.canceled &&
      _access.canEditMemberRsvp(_event.teamIds, allTeams: _event.allTeams);

  /// Met à jour le RSVP d’un convoqué via callable staff.
  Future<void> _setMemberRsvp({
    required String audienceId,
    required RsvpStatus status,
  }) async {
    final eventService = ref.read(eventServiceProvider);
    try {
      await eventService.updateRsvp(
        clubId: widget.clubId,
        eventId: _event.id,
        uid: audienceId,
        status: status,
        viaCallable: true,
      );
      if (!mounted) return;
      final fresh = await eventService.getEvent(
        clubId: widget.clubId,
        eventId: _event.id,
      );
      if (!mounted) return;
      if (fresh != null) setState(() => _event = fresh);
      widget.onRsvpUpdated?.call();
      ViroSnackBar.show(context, AppCopy.planning.staffRsvpUpdated);
    } catch (_) {
      if (!mounted) return;
      ViroHaptics.error();
      ViroSnackBar.show(context, AppCopy.planning.staffRsvpUpdateFailed);
    }
  }

  /// Coach : événement d'équipe(s) à venir, convocations modifiables.
  bool get _canManageConvocations {
    if (!_canManageAudience || _event.canceled) return false;
    if (_event.teamIds.isEmpty || _event.allTeams) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return !_event.date.isBefore(today);
  }

  Future<void> _openConvocations() async {
    final saved = await PlanningConvocationSheet.show(
      context: context,
      clubId: widget.clubId,
      event: _event,
    );
    if (!saved || !mounted) return;
    final fresh = await ref.read(eventServiceProvider).getEvent(
          clubId: widget.clubId,
          eventId: _event.id,
        );
    if (!mounted) return;
    if (fresh != null) setState(() => _event = fresh);
    widget.onRsvpUpdated?.call();
  }

  /// Coach / admin : infos d'un événement non annulé modifiables.
  bool get _canEditEvent => _canManageEvent && !_event.canceled;

  Future<void> _openEditEvent() async {
    final saved = await PlanningEditEventSheet.show(
      context: context,
      clubId: widget.clubId,
      event: _event,
    );
    if (!saved || !mounted) return;
    final fresh = await ref.read(eventServiceProvider).getEvent(
          clubId: widget.clubId,
          eventId: _event.id,
        );
    if (!mounted) return;
    if (fresh != null) setState(() => _event = fresh);
    widget.onRsvpUpdated?.call();
  }

  /// Cible RSVP de la feuille selon [PlanningEventDetailSheet.rsvpAudience],
  /// suivie dans `build()` (`null` tant qu'elle n'est pas connue).
  RsvpTarget? _watchRsvpTarget() => switch (widget.rsvpAudience) {
        RsvpAudience.self => ref.watch(selfRsvpTargetProvider(widget.clubId)),
        RsvpAudience.selectedAudience =>
          ref.watch(rsvpTargetProvider(widget.clubId)).asData?.value,
      };

  /// Cible RSVP de la feuille, lue au moment d'écrire la réponse.
  Future<RsvpTarget?> _readRsvpTarget() async =>
      switch (widget.rsvpAudience) {
        RsvpAudience.self => ref.read(selfRsvpTargetProvider(widget.clubId)),
        RsvpAudience.selectedAudience =>
          await ref.read(rsvpTargetProvider(widget.clubId).future),
      };

  /// Met à jour le RSVP de la cible de la feuille (soi ou enfant), puis
  /// rafraîchit le détail.
  Future<void> _setRsvp(RsvpStatus status) async {
    final rsvpTarget = await _readRsvpTarget();
    if (rsvpTarget == null) return;

    final eventService = ref.read(eventServiceProvider);
    try {
      await eventService.updateRsvp(
        clubId: widget.clubId,
        eventId: _event.id,
        uid: rsvpTarget.memberId,
        status: status,
        viaCallable: rsvpTarget.viaCallable,
      );
      final fresh = await eventService.getEvent(
        clubId: widget.clubId,
        eventId: _event.id,
      );
      if (!mounted) return;
      if (fresh != null) setState(() => _event = fresh);
      widget.onRsvpUpdated?.call();
    } catch (_) {
      widget.onRsvpUpdated?.call();
      if (mounted) {
        ViroHaptics.error();
        ViroSnackBar.show(context, AppCopy.planning.rsvpFailed);
      }
    }
  }

  /// Envoie une notification push ponctuelle à l'audience de l'événement.
  Future<void> _sendEventPush() async {
    if (_sendingPush) return;
    setState(() => _sendingPush = true);
    try {
      await ref.read(pushNotificationServiceProvider).sendEventPush(
            clubId: widget.clubId,
            eventId: _event.id,
          );
      if (!mounted) return;
      ViroStatusToast.show(
        context,
        message: AppCopy.planning.notifSent,
        success: true,
      );
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().contains('resource-exhausted')
          ? AppCopy.planning.notifRateLimited
          : AppCopy.planning.notifSendFailed;
      ViroStatusToast.show(
        context,
        message: message,
        success: false,
      );
    } finally {
      if (mounted) setState(() => _sendingPush = false);
    }
  }

  /// Coachs en tête, puis joueurs ; dans chaque groupe : présent → en attente →
  /// absent, puis alphabétique.
  List<({String id, ClubMember member, ViroRole? badge})> _sortedEntries(
    Map<String, ClubMember> byId,
    List<ClubTeam> eventTeams,
  ) {
    int order(RsvpStatus status) => switch (status) {
          RsvpStatus.yes => 0,
          RsvpStatus.none || RsvpStatus.maybe => 1,
          RsvpStatus.no => 2,
        };

    int compareEntries(
      ({String id, ClubMember member, ViroRole? badge}) left,
      ({String id, ClubMember member, ViroRole? badge}) right,
    ) {
      final statusOrder = order(_event.rsvpStatusForUser(left.id))
          .compareTo(order(_event.rsvpStatusForUser(right.id)));
      if (statusOrder != 0) return statusOrder;
      return left.member.fullName
          .toLowerCase()
          .compareTo(right.member.fullName.toLowerCase());
    }

    final seenIds = <String>{};
    final coachEntries = <({String id, ClubMember member, ViroRole? badge})>[];

    for (final team in eventTeams) {
      for (final coachId in team.coachIds) {
        final member = byId[coachId];
        if (member == null || !seenIds.add(coachId)) continue;
        coachEntries.add((
          id: coachId,
          member: member,
          badge: planningRsvpRowBadge(
            event: _event,
            member: member,
            coachesEventTeam: true,
          ),
        ));
      }
    }
    coachEntries.sort(compareEntries);

    final playerEntries = <({String id, ClubMember member, ViroRole? badge})>[];
    for (final id in _event.playerMemberIds(widget.excludeCoachUids)) {
      final member = byId[id];
      if (member == null || !seenIds.add(id)) continue;
      playerEntries.add((
        id: id,
        member: member,
        badge: planningRsvpRowBadge(
          event: _event,
          member: member,
          coachesEventTeam: false,
        ),
      ));
    }
    playerEntries.sort(compareEntries);

    return [...coachEntries, ...playerEntries];
  }

  Widget _buildMembersList(TextTheme theme) {
    final palette = context.viroPalette;
    final membersAsync = ref.watch(clubMembersProvider(widget.clubId));
    final teams = ref.watch(clubTeamsProvider(widget.clubId)).value ?? [];
    final eventTeams = _eventTeams(teams);

    return membersAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(ViroSpacing.xl),
        child: Center(child: ViroLogoLoader()),
      ),
      error: (_, _) => const ViroErrorState(),
      data: (members) {
        final entries =
            _sortedEntries(indexClubMembersById(members), eventTeams);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              AppCopy.planning.responsesCount(entries.length),
              style: theme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: palette.brandText,
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            if (entries.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: ViroSpacing.lg),
                child: Text(
                  AppCopy.planning.noMembersCalled,
                  style: theme.bodyMedium?.copyWith(color: palette.textSecondary),
                ),
              )
            else
              ..._memberRows(entries),
          ],
        );
      },
    );
  }

  /// Lignes de réponse ; les yeux « vu » s'ouvrent en cascade dans l'ordre
  /// de la liste (rang compté parmi les seules lignes « vu »).
  List<Widget> _memberRows(
    List<({String id, ClubMember member, ViroRole? badge})> entries,
  ) {
    final club = ref.watch(clubProvider(widget.clubId)).value;
    final accent = ref.watch(clubMemberAccentProvider(widget.clubId));
    var seenRank = 0;
    final rows = <Widget>[];
    for (final entry in entries) {
      final status = _event.rsvpStatusForUser(entry.id);
      final lastUpdatedAt = _event.rsvpUpdatedAtForUser(entry.id);
      final seenAt = _event.seenAtForUser(entry.id);
      final opensEye = seenAt != null &&
          PlanningMemberRsvpRow.showsSeenEye(
            status: status,
            lastUpdatedAt: lastUpdatedAt,
          );
      final member = entry.member;
      rows.add(
        PlanningMemberRsvpRow(
          key: ValueKey(entry.id),
          member: member,
          status: status,
          lastUpdatedAt: lastUpdatedAt,
          seenAt: seenAt,
          seenEyeDelay: opensEye
              ? ViroMotion.seenEyeStartDelay +
                  ViroMotion.seenEyeStagger * seenRank++
              : Duration.zero,
          badge: entry.badge,
          onRsvpSelected: _canEditMemberRsvp
              ? (next) => _setMemberRsvp(
                    audienceId: entry.id,
                    status: next,
                  )
              : null,
          onProfileTap: club != null && member.hasLinkedAccount
              ? () => showMemberDetailSheet(
                    context,
                    ref: ref,
                    club: club,
                    member: member,
                    accentColor: accent,
                  )
              : null,
        ),
      );
    }
    return rows;
  }

  /// Équipes ciblées par l'événement (aucune si pas d'équipe liée).
  List<ClubTeam> _eventTeams(List<ClubTeam> teams) {
    if (_event.teamIds.isEmpty) return const [];
    final eventTeamIds = _event.teamIds.toSet();
    return teams.where((team) => eventTeamIds.contains(team.id)).toList();
  }

  Future<void> _cancelEvent() async {
    final scope = await _askCancelScope();
    if (scope == null || !mounted) return;

    final service = ref.read(eventServiceProvider);
    if (scope == _CancelScope.series) {
      final seriesId = _event.seriesId!;
      final count = await service.cancelEventSeries(
        clubId: widget.clubId,
        seriesId: seriesId,
        title: _event.title,
      );
      if (!mounted) return;
      Navigator.pop(context);
      widget.onCanceled();
      ViroSnackBar.show(
        context,
        AppCopy.planning.eventsCancelled(count),
      );
      return;
    }

    await service.cancelEvent(
      clubId: widget.clubId,
      eventId: _event.id,
      title: _event.title,
    );
    if (!mounted) return;
    Navigator.pop(context);
    widget.onCanceled();
    ViroSnackBar.show(context, AppCopy.planning.eventCancelled);
  }

  Future<_CancelScope?> _askCancelScope() async {
    if (!_event.isRecurringSeries) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(AppCopy.planning.cancelEventTitle),
          content: Text(
            AppCopy.planning.cancelEventBody,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(AppCopy.common.no),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(AppCopy.common.cancel),
            ),
          ],
        ),
      );
      return confirm == true ? _CancelScope.single : null;
    }

    return showDialog<_CancelScope>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppCopy.planning.cancelSeriesTitle),
        content: Text(
          AppCopy.planning.cancelSeriesBody,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(AppCopy.common.back),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, _CancelScope.single),
            child: Text(AppCopy.planning.thisEventOnly),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, _CancelScope.series),
            child: Text(AppCopy.planning.wholeSeries),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final event = _event;
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final accent = Theme.of(context).colorScheme.primary;
    final headline = PlanningEventDisplay.headline(event);
    final subtitle = PlanningEventDisplay.subtitle(event, widget.teamLabel);
    final location = PlanningEventDisplay.locationLine(event);
    final isAwayMatch = event.type == EventTypes.match &&
        event.matchVenue == MatchVenues.away;
    final startStr = formatEventTime(event.startTime);
    final endStr = formatEventTime(event.endTime);
    final rdvStr = formatEventTime(event.meetingTime);
    final meetingLocation = event.meetingLocation?.trim();
    final dateStr = formatEventDate(event.date);
    final teamsById = <String, ClubTeam>{
      for (final team in ref.watch(clubTeamsProvider(widget.clubId)).value ?? [])
        team.id: team,
    };
    final counts =
        PlanningEventDisplay.rsvpCountsIncludingCoaches(event, teamsById);
    final rsvpTarget = _watchRsvpTarget();
    final canRsvp = !event.canceled &&
        rsvpTarget != null &&
        PlanningEventDisplay.canRsvpOnEvent(
          event,
          rsvpTarget.memberId,
          teamsById,
        );
    final rsvpStatus =
        canRsvp ? event.rsvpStatusForUser(rsvpTarget.memberId) : null;
    final rsvpRow = canRsvp
        ? PlanningRsvpCountChoiceRow(
            counts: counts,
            status: rsvpStatus ?? RsvpStatus.none,
            onSelected: _setRsvp,
          )
        : PlanningRsvpSummaryRow(counts: counts);

    return Column(
      children: [
        Expanded(
          child: ListView(
            controller: widget.scrollController,
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.lg,
              ViroSpacing.md,
              ViroSpacing.lg,
              ViroSpacing.md,
            ),
            children: [
              if (isAwayMatch)
                _AwayMatchHeader(
                  typeIcon: _typeIcon,
                  headline: headline,
                  subtitle: subtitle,
                  dateStr: dateStr,
                  rdvStr: rdvStr,
                  meetingLocation: meetingLocation,
                  matchTimeStr: startStr,
                  matchAddress: location,
                  accent: accent,
                  rsvpRow: rsvpRow,
                )
              else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (startStr.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(right: ViroSpacing.sm),
                        child: Column(
                          children: [
                            Text(
                              startStr,
                              style: theme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: palette.brandText,
                                height: 1.1,
                              ),
                            ),
                            if (event.type == EventTypes.match &&
                                rdvStr.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(
                                  AppCopy.planning.rdvPrefix(rdvStr),
                                  style: theme.labelSmall?.copyWith(
                                    color: palette.textSecondary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              )
                            else if (endStr.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(
                                  endStr,
                                  style: theme.labelSmall?.copyWith(
                                    color: palette.textMuted,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Row(
                                  children: [
                                    ViroIcon(
                                      _typeIcon,
                                      size: 18,
                                      color: accent,
                                    ),
                                    const SizedBox(width: ViroSpacing.xs),
                                    Expanded(
                                      child: Text(
                                        subtitle != null
                                            ? '$headline · $subtitle'
                                            : headline,
                                        style: theme.titleSmall?.copyWith(
                                          fontWeight: FontWeight.w700,
                                          color: palette.brandText,
                                          height: 1.2,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: ViroSpacing.sm),
                              rsvpRow,
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            dateStr,
                            style: theme.bodySmall?.copyWith(
                              color: palette.textSecondary,
                              height: 1.3,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (location != null) ...[
                            const SizedBox(height: 2),
                            Text.rich(
                              TextSpan(
                                style: theme.bodySmall?.copyWith(
                                  color: palette.textSecondary,
                                  height: 1.3,
                                ),
                                children: [
                                  WidgetSpan(
                                    alignment: PlaceholderAlignment.middle,
                                    child: Padding(
                                      padding: const EdgeInsets.only(right: 2),
                                      child: ViroIcon(
                                        ViroIcons.place,
                                        size: 13,
                                        color: palette.textMuted,
                                      ),
                                    ),
                                  ),
                                  TextSpan(text: location),
                                ],
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              _buildStaffActionsGrid(rsvpMemberId: rsvpTarget?.memberId),
              const SizedBox(height: ViroSpacing.md),
              _buildMembersList(theme),
              if (_canManageEvent) ...[
                const SizedBox(height: ViroSpacing.md),
                FilledButton(
                  onPressed: _cancelEvent,
                  style: FilledButton.styleFrom(
                    backgroundColor: ViroColors.error,
                    foregroundColor: ViroColors.white,
                    minimumSize: const Size.fromHeight(
                      ViroSpacing.buttonHeightMedium,
                    ),
                  ),
                  child: Text(AppCopy.planning.cancelEventAction),
                ),
              ],
              SizedBox(height: MediaQuery.paddingOf(context).bottom),
            ],
          ),
        ),
      ],
    );
  }
}

/// En-tête dédié match extérieur : titre, puis RDV et match séparés.
class _AwayMatchHeader extends StatelessWidget {
  const _AwayMatchHeader({
    required this.typeIcon,
    required this.headline,
    required this.subtitle,
    required this.dateStr,
    required this.rdvStr,
    required this.meetingLocation,
    required this.matchTimeStr,
    required this.matchAddress,
    required this.accent,
    required this.rsvpRow,
  });

  final IconData typeIcon;
  final String headline;
  final String? subtitle;
  final String dateStr;
  final String rdvStr;
  final String? meetingLocation;
  final String matchTimeStr;
  final String? matchAddress;
  final Color accent;
  final Widget rsvpRow;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final trimmedMeeting = meetingLocation?.trim();
    final trimmedAddress = matchAddress?.trim();
    final hasMeetingPlace =
        trimmedMeeting != null && trimmedMeeting.isNotEmpty;
    final hasMatchAddress =
        trimmedAddress != null && trimmedAddress.isNotEmpty;
    final hasRdv = rdvStr.isNotEmpty || hasMeetingPlace;
    final hasMatch = matchTimeStr.isNotEmpty || hasMatchAddress;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Row(
                children: [
                  ViroIcon(typeIcon, size: 18, color: accent),
                  const SizedBox(width: ViroSpacing.xs),
                  Expanded(
                    child: Text(
                      subtitle != null ? '$headline · $subtitle' : headline,
                      style: theme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: palette.brandText,
                        height: 1.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: ViroSpacing.sm),
            rsvpRow,
          ],
        ),
        const SizedBox(height: 2),
        Text(
          AppCopy.planning.awayWithDate(dateStr),
          style: theme.bodySmall?.copyWith(
            color: palette.textSecondary,
            height: 1.3,
          ),
        ),
        if (hasRdv || hasMatch) ...[
          const SizedBox(height: ViroSpacing.sm),
          ViroCard(
            elevated: false,
            accentColor: accent,
            padding: const EdgeInsets.symmetric(
              horizontal: ViroSpacing.sm + 4,
              vertical: ViroSpacing.sm,
            ),
            margin: EdgeInsets.zero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (hasRdv)
                  _AwayScheduleBlock(
                    label: AppCopy.planning.labelRdv,
                    timeStr: rdvStr,
                    place: trimmedMeeting,
                    accent: accent,
                    placeIcon: ViroIcons.users,
                  ),
                if (hasRdv && hasMatch) ...[
                  const SizedBox(height: ViroSpacing.sm),
                  Divider(
                    height: 1,
                    thickness: 1,
                    color: palette.accentSoft.withValues(alpha: 0.55),
                  ),
                  const SizedBox(height: ViroSpacing.sm),
                ],
                if (hasMatch)
                  _AwayScheduleBlock(
                    label: AppCopy.planning.labelMatch,
                    timeStr: matchTimeStr,
                    place: trimmedAddress,
                    accent: accent,
                    placeIcon: ViroIcons.place,
                    placeClickable: hasMatchAddress,
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// Bloc heure + lieu (RDV ou match) dans le détail extérieur.
class _AwayScheduleBlock extends StatelessWidget {
  const _AwayScheduleBlock({
    required this.label,
    required this.timeStr,
    required this.place,
    required this.accent,
    required this.placeIcon,
    this.placeClickable = false,
  });

  final String label;
  final String timeStr;
  final String? place;
  final Color accent;
  final IconData placeIcon;
  final bool placeClickable;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final trimmedPlace = place?.trim();
    final hasPlace = trimmedPlace != null && trimmedPlace.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              label,
              style: theme.labelSmall?.copyWith(
                color: palette.textMuted,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (timeStr.isNotEmpty) ...[
              const SizedBox(width: ViroSpacing.sm),
              Text(
                timeStr,
                style: theme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: palette.brandText,
                  height: 1.1,
                ),
              ),
            ],
          ],
        ),
        if (hasPlace) ...[
          const SizedBox(height: 2),
          if (placeClickable)
            _AwayAddressButton(address: trimmedPlace, accent: accent)
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: ViroIcon(
                    placeIcon,
                    size: 14,
                    color: palette.textMuted,
                  ),
                ),
                const SizedBox(width: ViroSpacing.xs),
                Expanded(
                  child: Text(
                    trimmedPlace,
                    style: theme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
        ],
      ],
    );
  }
}

/// Adresse match extérieur — ouverture Maps / Waze / Plans.
class _AwayAddressButton extends StatelessWidget {
  const _AwayAddressButton({
    required this.address,
    required this.accent,
  });

  final String address;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return ViroPressable(
      floating: false,
      minSize: 0,
      borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
      onTap: () => showOpenAddressSheet(context, address: address),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: ViroIcon(
                ViroIcons.place,
                size: 14,
                color: accent,
              ),
            ),
            const SizedBox(width: ViroSpacing.xs),
            Expanded(
              child: Text(
                address,
                style: theme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: accent,
                  height: 1.3,
                  decoration: TextDecoration.underline,
                  decorationColor: accent.withValues(alpha: 0.4),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 1, left: ViroSpacing.xs),
              child: ViroIcon(
                ViroIcons.chevronRight,
                size: 14,
                color: accent,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Action compacte de la grille du détail événement (icône + libellé court).
class _EventDetailAction {
  const _EventDetailAction({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.primary = false,
    this.busy = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final bool primary;
  final bool busy;
}

/// Bouton d'une case de la grille d'actions du détail événement.
class _EventDetailActionButton extends StatelessWidget {
  const _EventDetailActionButton({required this.action});

  final _EventDetailAction action;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final icon = action.busy
        ? SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: action.primary ? palette.onAccent : null,
            ),
          )
        : ViroIcon(action.icon, size: 16);
    final style = ButtonStyle(
      minimumSize: const WidgetStatePropertyAll(
        Size(0, ViroSpacing.minTouchTarget),
      ),
      padding: const WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: ViroSpacing.sm),
      ),
      visualDensity: VisualDensity.compact,
      textStyle: WidgetStatePropertyAll(
        Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
            ),
      ),
    );

    if (action.primary) {
      return FilledButton.icon(
        onPressed: action.onPressed,
        icon: icon,
        label: Text(action.label, maxLines: 1, overflow: TextOverflow.ellipsis),
        style: style,
      );
    }
    return OutlinedButton.icon(
      onPressed: action.onPressed,
      icon: icon,
      label: Text(action.label, maxLines: 1, overflow: TextOverflow.ellipsis),
      style: style,
    );
  }
}
