import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/planning/utils/planning_event_display.dart';
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
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_status_toast.dart';

enum _CancelScope { single, series }

class PlanningEventDetailSheet extends ConsumerStatefulWidget {
  const PlanningEventDetailSheet({
    super.key,
    required this.clubId,
    required this.event,
    required this.scrollController,
    this.teamLabel,
    this.excludeCoachUids = const {},
    this.canManageEvents = true,
    required this.onCanceled,
  });

  final String clubId;
  final ClubEvent event;
  final ScrollController scrollController;
  final String? teamLabel;
  final Set<String> excludeCoachUids;
  final bool canManageEvents;
  final VoidCallback onCanceled;

  static Future<void> show({
    required BuildContext context,
    required WidgetRef ref,
    required String clubId,
    required ClubEvent event,
    String? teamLabel,
    Set<String> excludeCoachUids = const {},
    bool canManageEvents = true,
    required VoidCallback onCanceled,
  }) {
    final accent = ref.read(clubMemberAccentProvider(clubId));

    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      isDismissible: true,
      enableDrag: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => ClubAccentTheme(
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
            canManageEvents: canManageEvents,
            onCanceled: onCanceled,
          ),
        ),
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

  IconData get _typeIcon => switch (widget.event.type) {
        EventTypes.training => ViroIcons.whistle,
        EventTypes.match => ViroIcons.ball,
        EventTypes.tournament => ViroIcons.trophy,
        _ => ViroIcons.calendar,
      };

  /// Envoie une notification push ponctuelle à l'audience de l'événement.
  Future<void> _sendEventPush() async {
    if (_sendingPush) return;
    setState(() => _sendingPush = true);
    try {
      await ref.read(pushNotificationServiceProvider).sendEventPush(
            clubId: widget.clubId,
            eventId: widget.event.id,
          );
      if (!mounted) return;
      ViroStatusToast.show(
        context,
        message: 'Notif envoyée',
        success: true,
      );
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().contains('resource-exhausted')
          ? 'Une notification a déjà été envoyée il y a moins d’une heure'
          : 'Envoi impossible, réessayez';
      ViroStatusToast.show(
        context,
        message: message,
        success: false,
      );
    } finally {
      if (mounted) setState(() => _sendingPush = false);
    }
  }

  /// RSVP d'un membre en tenant compte de toutes ses clés audience.
  RsvpStatus _rsvpForMember(String id, ClubMember member) =>
      widget.event.rsvpStatusForUser(
        id,
        clubAudienceId: member.memberId,
        memberAudienceKeys: eventAudienceKeys(member),
      );

  /// Coachs en tête, puis joueurs ; dans chaque groupe : présent → en attente →
  /// absent, puis alphabétique.
  List<({String id, ClubMember member, bool isCoach})> _sortedEntries(
    Map<String, ClubMember> byUid,
    List<ClubTeam> eventTeams,
  ) {
    int order(RsvpStatus status) => switch (status) {
          RsvpStatus.yes => 0,
          RsvpStatus.none || RsvpStatus.maybe => 1,
          RsvpStatus.no => 2,
        };

    int compareEntries(
      ({String id, ClubMember member, bool isCoach}) left,
      ({String id, ClubMember member, bool isCoach}) right,
    ) {
      final statusOrder = order(_rsvpForMember(left.id, left.member))
          .compareTo(order(_rsvpForMember(right.id, right.member)));
      if (statusOrder != 0) return statusOrder;
      return left.member.fullName
          .toLowerCase()
          .compareTo(right.member.fullName.toLowerCase());
    }

    final seenKeys = <String>{};
    final coachEntries = <({String id, ClubMember member, bool isCoach})>[];

    for (final team in eventTeams) {
      for (final coachRosterId in team.coachIds) {
        final member = clubMemberForTeamUid(byUid, coachRosterId);
        if (member == null) continue;
        final keys = eventAudienceKeys(member);
        if (keys.any(seenKeys.contains)) continue;
        seenKeys.addAll(keys);
        coachEntries.add((
          id: rosterAudienceId(member),
          member: member,
          isCoach: true,
        ));
      }
    }
    coachEntries.sort(compareEntries);

    final playerEntries = <({String id, ClubMember member, bool isCoach})>[];
    for (final id in widget.event.playerMemberIds(widget.excludeCoachUids)) {
      final member = clubMemberForTeamUid(byUid, id);
      if (member == null) continue;
      final keys = eventAudienceKeys(member);
      if (keys.any(seenKeys.contains)) continue;
      seenKeys.addAll(keys);
      playerEntries.add((id: id, member: member, isCoach: false));
    }
    playerEntries.sort(compareEntries);

    return [...coachEntries, ...playerEntries];
  }

  Widget _buildMembersList(TextTheme theme) {
    final accent = Theme.of(context).colorScheme.primary;
    final membersAsync = ref.watch(clubMembersProvider(widget.clubId));
    final teams = ref.watch(clubTeamsProvider(widget.clubId)).value ?? [];
    final eventTeams = _eventTeams(teams);

    return membersAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(ViroSpacing.xl),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (_, __) => const ViroErrorState(),
      data: (members) {
        final byUid = indexClubMembersByUid(members);
        final entries = _sortedEntries(byUid, eventTeams);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Réponses (${entries.length})',
              style: theme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: accent,
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            if (entries.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: ViroSpacing.lg),
                child: Text(
                  'Aucun membre convoqué',
                  style: theme.bodyMedium?.copyWith(color: ViroColors.gray600),
                ),
              )
            else
              for (final entry in entries)
                PlanningMemberRsvpRow(
                  member: entry.member,
                  status: _rsvpForMember(entry.id, entry.member),
                  isTeamCoach: entry.isCoach,
                ),
          ],
        );
      },
    );
  }

  /// Équipes ciblées par l'événement (aucune si pas d'équipe liée).
  List<ClubTeam> _eventTeams(List<ClubTeam> teams) {
    if (widget.event.teamIds.isEmpty) return const [];
    final eventTeamIds = widget.event.teamIds.toSet();
    return teams.where((team) => eventTeamIds.contains(team.id)).toList();
  }

  Future<void> _cancelEvent() async {
    final scope = await _askCancelScope();
    if (scope == null || !mounted) return;

    final service = ref.read(eventServiceProvider);
    if (scope == _CancelScope.series) {
      final seriesId = widget.event.seriesId!;
      final count = await service.cancelEventSeries(
        clubId: widget.clubId,
        seriesId: seriesId,
      );
      if (!mounted) return;
      Navigator.pop(context);
      widget.onCanceled();
      ViroSnackBar.show(
        context,
        count > 1 ? '$count événements annulés' : 'Événement annulé',
      );
      return;
    }

    await service.cancelEvent(
      clubId: widget.clubId,
      eventId: widget.event.id,
    );
    if (!mounted) return;
    Navigator.pop(context);
    widget.onCanceled();
    ViroSnackBar.show(context, 'Événement annulé');
  }

  Future<_CancelScope?> _askCancelScope() async {
    if (!widget.event.isRecurringSeries) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Annuler l\'événement ?'),
          content: const Text(
            'Les membres ne verront plus cet événement dans leur planning.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Non'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Annuler'),
            ),
          ],
        ),
      );
      return confirm == true ? _CancelScope.single : null;
    }

    return showDialog<_CancelScope>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Annuler l\'événement'),
        content: const Text(
          'Cet entraînement fait partie d\'une série récurrente. '
          'Que souhaitez-vous annuler ?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Retour'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, _CancelScope.single),
            child: const Text('Cet événement seulement'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, _CancelScope.series),
            child: const Text('Toute la série'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final event = widget.event;
    final theme = Theme.of(context).textTheme;
    final accent = Theme.of(context).colorScheme.primary;
    final headline = PlanningEventDisplay.headline(event);
    final subtitle = PlanningEventDisplay.subtitle(event, widget.teamLabel);
    final location = PlanningEventDisplay.locationLine(event);
    final startStr = formatEventTime(event.startTime);
    final endStr = formatEventTime(event.endTime);
    final rdvStr = formatEventTime(event.meetingTime);
    final dateStr = formatEventDate(event.date);
    final teamsById = <String, ClubTeam>{
      for (final team in ref.watch(clubTeamsProvider(widget.clubId)).value ?? [])
        team.id: team,
    };
    final members = ref.watch(clubMembersProvider(widget.clubId)).value;
    final membersByUid =
        members != null ? indexClubMembersByUid(members) : null;
    final counts = PlanningEventDisplay.rsvpCountsIncludingCoaches(
      event,
      teamsById,
      membersByUid: membersByUid,
    );

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
                              color: accent,
                              height: 1.1,
                            ),
                          ),
                          if (event.type == EventTypes.match &&
                              rdvStr.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                'RDV $rdvStr',
                                style: theme.labelSmall?.copyWith(
                                  color: ViroColors.gray600,
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
                                  color: ViroColors.gray400,
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
                                        color: accent,
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
                            PlanningRsvpSummaryRow(counts: counts),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text.rich(
                          TextSpan(
                            style: theme.bodySmall?.copyWith(
                              color: ViroColors.gray600,
                              height: 1.3,
                            ),
                            children: [
                              TextSpan(text: dateStr),
                              if (location != null) ...[
                                const TextSpan(text: ' · '),
                                WidgetSpan(
                                  alignment: PlaceholderAlignment.middle,
                                  child: Padding(
                                    padding: const EdgeInsets.only(right: 2),
                                    child: ViroIcon(
                                      ViroIcons.place,
                                      size: 13,
                                      color: ViroColors.gray400,
                                    ),
                                  ),
                                ),
                                TextSpan(text: location),
                              ],
                            ],
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (widget.canManageEvents) ...[
                const SizedBox(height: ViroSpacing.sm),
                FilledButton.icon(
                  onPressed: _sendingPush ? null : _sendEventPush,
                  icon: _sendingPush
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: ViroColors.white,
                          ),
                        )
                      : ViroIcon(ViroIcons.bell, size: 18),
                  label: Text(
                    _sendingPush ? 'Envoi…' : 'Envoyer une notification',
                  ),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(
                      ViroSpacing.buttonHeightMedium,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: ViroSpacing.md),
              _buildMembersList(theme),
              if (widget.canManageEvents) ...[
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
                  child: const Text('Annuler l\'événement'),
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
