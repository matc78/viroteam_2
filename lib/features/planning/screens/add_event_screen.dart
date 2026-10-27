import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/navigation_fallback.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/planning/providers/planning_providers.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_form_controller.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_helpers.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_audience_section.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_convocation_section.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_location_section.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_more_options_section.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_save_bar.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_schedule_card.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_type_team_section.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Écran de création d’événement (composition + wiring Riverpod).
class AddEventScreen extends ConsumerStatefulWidget {
  /// Ouvre le formulaire pour [clubId], avec [initialDate] optionnelle.
  const AddEventScreen({
    super.key,
    required this.clubId,
    this.initialDate,
  });

  final String clubId;
  final DateTime? initialDate;

  @override
  ConsumerState<AddEventScreen> createState() => _AddEventScreenState();
}

class _AddEventScreenState extends ConsumerState<AddEventScreen> {
  late final AddEventFormController _form;

  @override
  void initState() {
    super.initState();
    _form = AddEventFormController(initialDate: widget.initialDate);
    _form.addListener(_onFormChanged);
  }

  void _onFormChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _form.removeListener(_onFormChanged);
    _form.dispose();
    super.dispose();
  }

  Future<void> _pickDate({required bool isRecurrenceEnd}) async {
    final club = ref.read(clubProvider(widget.clubId)).value;
    final picked = await showDatePicker(
      context: context,
      locale: const Locale('fr', 'FR'),
      initialDate: isRecurrenceEnd
          ? (_form.recurrenceEndDate ??
              addEventSeasonRecurrenceEnd(club, _form.date))
          : _form.date,
      firstDate: isRecurrenceEnd
          ? _form.date
          : DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    if (picked == null) return;
    if (isRecurrenceEnd) {
      _form.setRecurrenceEndDate(picked);
    } else {
      _form.setDate(picked, club: club);
    }
  }

  Future<void> _pickTime({
    required void Function(TimeOfDay) onPicked,
    required TimeOfDay initial,
  }) async {
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked != null) onPicked(picked);
  }

  /// Ids des joueurs de l'équipe du match (vide hors match / en chargement).
  List<String> _matchPlayerIds(
    List<({String id, ClubMember member})>? players,
  ) =>
      _form.isMatch && players != null
          ? [for (final player in players) player.id]
          : const [];

  /// Joueurs de l'équipe choisie pour un match, `null` sinon ou en chargement.
  List<({String id, ClubMember member})>? _watchMatchPlayers() {
    final teamId = _form.teamId;
    if (!_form.isMatch || teamId == null) return null;
    return ref.watch(
      teamConvocationPlayersProvider((clubId: widget.clubId, teamId: teamId)),
    );
  }

  Future<void> _save() async {
    final club = ref.read(clubProvider(widget.clubId)).value;
    final teamId = _form.teamId;
    final matchPlayerIds = _matchPlayerIds(
      _form.isMatch && teamId != null
          ? ref.read(
              teamConvocationPlayersProvider(
                (clubId: widget.clubId, teamId: teamId),
              ),
            )
          : null,
    );
    final error =
        _form.validationMessage(club, matchPlayerIds: matchPlayerIds);
    if (error != null) {
      ViroSnackBar.show(context, error);
      return;
    }

    final uid = ref.read(authStateProvider).value?.uid;
    final teams = ref.read(clubTeamsProvider(widget.clubId)).value ?? [];
    try {
      // « Tout le club » convoque chaque membre : la liste doit être chargée.
      final members = ref.read(clubMembersProvider(widget.clubId)).value ??
          await ref
              .read(clubMembersProvider(widget.clubId).future)
              .timeout(const Duration(seconds: 8));
      if (!mounted) return;
      final count = await _form.save(
        clubId: widget.clubId,
        creatorId: uid,
        club: club,
        teams: teams,
        members: members,
        eventService: ref.read(eventServiceProvider),
        matchPlayerIds: matchPlayerIds,
      );
      if (count == null || !mounted) return;
      ViroSnackBar.show(context, AppCopy.planning.eventsCreated(count));
      _leave();
    } catch (e) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.common.errorWithDetails(e));
      }
    }
  }

  /// Écran parent logique si la pile est vide (deep link).
  String get _fallbackRoute => AppRoutes.clubPlanningPath(widget.clubId);

  /// Quitte l'écran sans confirmation (après création ou abandon confirmé).
  void _leave() => popOrGo(context, _fallbackRoute);

  /// Retour (AppBar ou système) : confirme l'abandon si le formulaire a été
  /// touché, sinon quitte directement.
  Future<void> _requestLeave() async {
    if (_form.saving) return;
    if (!_form.hasUserEdits) {
      _leave();
      return;
    }
    final discard = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(AppCopy.planning.discardEventTitle),
        content: Text(AppCopy.planning.discardEventBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(AppCopy.planning.keepEditing),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(AppCopy.planning.discardEventConfirm),
          ),
        ],
      ),
    );
    if (discard == true && mounted) _leave();
  }

  @override
  Widget build(BuildContext context) {
    final member = ref.watch(clubMemberProvider(widget.clubId)).value;
    if (member != null &&
        !MemberRoleHierarchy.isCoachOrAbove(member.role)) {
      return ViroScaffold(
        fallbackRoute: _fallbackRoute,
        appBar: ViroAppBar(
          fallbackRoute: _fallbackRoute,
          title: Text(AppCopy.planning.newEventTitle),
        ),
        body: ViroEmptyState(
          icon: ViroIcons.block,
          message: AppCopy.planning.reservedToCoachesAdmins,
          actionLabel: AppCopy.common.back,
          onAction: _leave,
        ),
      );
    }

    final teamsAsync = ref.watch(clubTeamsProvider(widget.clubId));
    final clubAsync = ref.watch(clubProvider(widget.clubId));
    // Couleur club rendue lisible sur le fond courant (éclaircie en sombre),
    // comme dans `ClubAccentTheme` ; texte foncé fixe sur un accent clair.
    final palette = context.viroPalette;
    final accent = palette.readableAccent(
      ref.watch(clubManagementAccentProvider(widget.clubId)),
    );
    final onAccent = ClubAccentTheme.onAccentFor(accent, palette);

    // Retour système : intercepté pour confirmer l'abandon d'une saisie.
    // (`context.pop()` / `popOrGo` forcent le pop et ne passent pas ici.)
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _requestLeave();
      },
      child: ClubAccentTheme(
        accentColor: accent,
        child: ViroScaffold(
          appBar: ViroAppBar(
            leading: IconButton(
              tooltip: AppCopy.common.back,
              icon: ViroIcon(ViroIcons.chevronLeft),
              onPressed: _form.saving ? null : _requestLeave,
            ),
            title: Text(AppCopy.planning.newEventTitle),
          ),
          body: teamsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, stackTrace) => ViroErrorState(
              onRetry: () => ref.invalidate(clubTeamsProvider(widget.clubId)),
            ),
            data: (teams) => _buildForm(
              teams: teams,
              club: clubAsync.value,
              member: member,
              accent: accent,
              onAccent: onAccent,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildForm({
    required List<ClubTeam> teams,
    required Club? club,
    required ClubMember? member,
    required Color accent,
    required Color onAccent,
  }) {
    if (club != null && !_form.locationDefaultsApplied) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _form.locationDefaultsApplied) return;
        _form.applyLocationDefaults(club);
      });
    }

    final sortedTeams = addEventSortedTeams(teams, member);
    if (_form.teamId == null &&
        sortedTeams.isNotEmpty &&
        !EventTypes.isTeamless(_form.type)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _form.teamId == null) {
          _form.ensureDefaultTeam(sortedTeams);
        }
      });
    }

    final practiceLocations =
        club?.practiceLocations ?? const <PracticeLocation>[];
    final enabled = !_form.saving;
    final matchPlayers = _watchMatchPlayers();
    final blockingReason = _form.blockingReason(
      club,
      matchPlayerIds: _matchPlayerIds(matchPlayers),
    );
    final canSubmit = blockingReason == null;
    final saveBarHeight = AddEventSaveBar.reservedHeight(
      context,
      showsReason: AddEventSaveBar.showsReasonFor(
        isLoading: _form.saving,
        canSubmit: canSubmit,
        blockingReason: blockingReason,
      ),
    );

    return Stack(
      children: [
        ListView(
          padding: EdgeInsets.fromLTRB(
            ViroSpacing.screenHorizontal,
            ViroSpacing.screenHorizontal,
            ViroSpacing.screenHorizontal,
            saveBarHeight + ViroSpacing.md,
          ),
          children: [
            AddEventTypeTeamSection(
              type: _form.type,
              teamId: _form.teamId,
              sortedTeams: sortedTeams,
              member: member,
              titleController: _form.titleController,
              accentColor: accent,
              enabled: enabled,
              onTypeChanged: _form.onTypeChanged,
              onTeamChanged: _form.setTeamId,
            ),
            // Quand ? juste après quoi / qui : l'info la plus attendue.
            AddEventScheduleCard(
              isMatch: _form.isMatch,
              date: _form.date,
              start: _form.start,
              end: _form.end,
              accentColor: accent,
              enabled: enabled,
              onPickDate: () => _pickDate(isRecurrenceEnd: false),
              onPickStart: () =>
                  _pickTime(initial: _form.start, onPicked: _form.setStartTime),
              onPickEnd: () =>
                  _pickTime(initial: _form.end, onPicked: _form.setEndTime),
            ),
            const SizedBox(height: ViroSpacing.md),
            if (_form.isMatch && _form.teamId != null)
              AddEventConvocationSection(
                players: matchPlayers,
                excludedIds: _form.excludedPlayerIds,
                accentColor: accent,
                enabled: enabled,
                onPlayerToggled: _form.togglePlayerConvoked,
              ),
            if (EventTypes.isTeamless(_form.type))
              AddEventAudienceSection(
                wholeClub: _form.audienceWholeClub,
                sortedTeams: sortedTeams,
                selectedTeamIds: _form.audienceTeamIds,
                accentColor: accent,
                enabled: enabled,
                onWholeClubChanged: _form.setAudienceWholeClub,
                onTeamToggled: _form.toggleAudienceTeam,
              ),
            AddEventLocationSection(
              isMatch: _form.isMatch,
              matchVenue: _form.matchVenue,
              useAwayLocationField: _form.useAwayLocationField,
              practiceLocations: practiceLocations,
              selectedLocationIndex: _form.selectedLocationIndex,
              locationController: _form.locationController,
              awayCityController: _form.awayCityController,
              awayPostalController: _form.awayPostalController,
              awayAddressController: _form.awayAddressController,
              addressService: _form.addressService,
              accentColor: accent,
              onAccentColor: onAccent,
              enabled: enabled,
              onMatchVenueChanged: _form.onMatchVenueChanged,
              onLocationIndexChanged: _form.setSelectedLocationIndex,
            ),
            AddEventMoreOptionsSection(
              isMatch: _form.isMatch,
              isTraining: _form.isTraining,
              practiceLocations: practiceLocations,
              meetingTime: _form.meetingTime,
              isRecurring: _form.isRecurring,
              recurrenceEndDate: _form.recurrenceEndDate,
              importantReminder: _form.importantReminder,
              selectedMeetingLocationIndex: _form.selectedMeetingLocationIndex,
              accentColor: accent,
              enabled: enabled,
              onPickMeetingTime: () => _pickTime(
                initial: _form.meetingTime,
                onPicked: _form.setMeetingTime,
              ),
              onRecurringChanged: (value) =>
                  _form.setRecurring(value, club: club),
              onPickRecurrenceEnd: () => _pickDate(isRecurrenceEnd: true),
              onImportantReminderChanged: _form.setImportantReminder,
              onMeetingLocationChanged: _form.setSelectedMeetingLocationIndex,
            ),
          ],
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: AddEventSaveBar(
            isRecurringSeries: _form.isRecurring && _form.isTraining,
            isLoading: _form.saving,
            canSubmit: canSubmit,
            blockingReason: blockingReason,
            onSubmit: _save,
          ),
        ),
      ],
    );
  }
}
