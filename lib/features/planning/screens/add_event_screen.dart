import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club_setup/services/french_address_service.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_format.dart';
import 'package:viro_team_v2/features/club_setup/widgets/french_address_fields.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/utils/season_end.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

class AddEventScreen extends ConsumerStatefulWidget {
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
  final _locationController = TextEditingController();
  final _titleController = TextEditingController();
  final _awayCityController = TextEditingController();
  final _awayPostalController = TextEditingController();
  final _awayAddressController = TextEditingController();
  final _addressService = FrenchAddressService();

  String _type = EventTypes.training;
  String? _teamId;
  late DateTime _date;
  TimeOfDay _start = const TimeOfDay(hour: 18, minute: 0);
  TimeOfDay _end = const TimeOfDay(hour: 19, minute: 30);
  TimeOfDay _meetingTime = const TimeOfDay(hour: 17, minute: 30);
  /// True dès que le coach ajuste manuellement l'heure de RDV.
  bool _meetingTimeManuallyEdited = false;
  String? _matchVenue;
  bool _isRecurring = false;
  DateTime? _recurrenceEndDate;
  bool _saving = false;
  int? _selectedLocationIndex;
  int? _selectedMeetingLocationIndex;
  bool _locationDefaultsApplied = false;

  bool get _isMatch => _type == EventTypes.match;
  bool get _isTraining => _type == EventTypes.training;

  /// Match extérieur → saisie adresse FR ; sinon liste des lieux du club.
  bool get _useAwayLocationField =>
      _isMatch && _matchVenue == MatchVenues.away;

  /// Fin de saison résolue (club ou défaut), bornée au jour de l'événement.
  DateTime _seasonRecurrenceEndFor(DateTime eventDay) {
    final club = ref.read(clubProvider(widget.clubId)).value;
    final seasonEnd = resolveSeasonEndDate(club?.seasonEndDate, eventDay);
    return recurrenceEndForEventDay(eventDay, seasonEnd);
  }

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _date = widget.initialDate ?? DateTime(now.year, now.month, now.day);
    _titleController.addListener(_onFormFieldEdited);
    _locationController.addListener(_onFormFieldEdited);
    _awayCityController.addListener(_onFormFieldEdited);
    _awayPostalController.addListener(_onFormFieldEdited);
    _awayAddressController.addListener(_onFormFieldEdited);
  }

  /// Rafraîchit l’état du bouton Créer quand un champ texte change.
  void _onFormFieldEdited() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _titleController.removeListener(_onFormFieldEdited);
    _locationController.removeListener(_onFormFieldEdited);
    _awayCityController.removeListener(_onFormFieldEdited);
    _awayPostalController.removeListener(_onFormFieldEdited);
    _awayAddressController.removeListener(_onFormFieldEdited);
    _locationController.dispose();
    _titleController.dispose();
    _awayCityController.dispose();
    _awayPostalController.dispose();
    _awayAddressController.dispose();
    _addressService.dispose();
    super.dispose();
  }

  String _formatTime(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  /// Libellé équipe pour les listes déroulantes (`Nom (catégorie)`).
  String _teamLabel(ClubTeam team) =>
      team.category != null && team.category!.isNotEmpty
          ? '${team.name} (${team.category})'
          : team.name;

  /// Ligne équipe avec « C » orange si l’utilisateur est coach de l’équipe.
  ///
  /// Pas de [Flexible]/[Expanded] : le champ fermé du dropdown impose une
  /// largeur non bornée (shrink-wrap), incompatible avec un flex enfant.
  Widget _teamDropdownRow({
    required ClubTeam team,
    required ClubMember? member,
    required TextStyle? style,
  }) {
    final isCoached = member != null && team.isOnCoachRoster(member);
    return Text.rich(
      TextSpan(
        style: style,
        children: [
          TextSpan(text: _teamLabel(team)),
          if (isCoached)
            TextSpan(
              text: ' C',
              style: TextStyle(
                color: ViroColors.coachBadgeEnd,
                fontWeight: FontWeight.w800,
                fontSize: 13,
                height: style?.height,
              ),
            ),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }

  /// Équipes coachées d’abord, puis ordre alphabétique sur le nom.
  List<ClubTeam> _sortedTeams(List<ClubTeam> teams, ClubMember? member) {
    final sorted = List<ClubTeam>.from(teams);
    sorted.sort((a, b) {
      final aCoached = member != null && a.isOnCoachRoster(member);
      final bCoached = member != null && b.isOnCoachRoster(member);
      if (aCoached != bCoached) return aCoached ? -1 : 1;
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });
    return sorted;
  }

  /// Libellé affiché / stocké pour un lieu de pratique.
  String _practiceLocationLabel(PracticeLocation location) {
    final address = location.address?.trim();
    if (address != null && address.isNotEmpty) {
      return '${location.name} ($address)';
    }
    return location.name;
  }

  /// Index du siège s’il existe, sinon le premier lieu, sinon `-1`.
  int _defaultLocationIndex(Club club) {
    final locations = club.practiceLocations;
    if (locations.isEmpty) return -1;
    final linked = ClubSetupFormat.linkedHeadquartersIndex(locations);
    if (linked >= 0) return linked;
    final headquarters = ClubSetupFormat.headquartersLocationIndex(
      address: club.address ?? '',
      postalCode: club.postalCode ?? '',
      city: club.city ?? '',
      sport: club.sport,
      locations: locations,
    );
    if (headquarters >= 0) return headquarters;
    return 0;
  }

  /// Applique une seule fois le lieu par défaut (siège ou premier lieu).
  void _applyLocationDefaults(Club club) {
    if (_locationDefaultsApplied) return;
    _locationDefaultsApplied = true;
    final index = _defaultLocationIndex(club);
    if (index >= 0) {
      _selectedLocationIndex = index;
      _selectedMeetingLocationIndex = index;
    }
  }

  /// Libellé du lieu de RDV sélectionné, ou `null` si absent.
  String? _resolveMeetingLocation(Club? club) {
    final locations = club?.practiceLocations ?? const <PracticeLocation>[];
    final index = _selectedMeetingLocationIndex;
    if (index != null && index >= 0 && index < locations.length) {
      return _practiceLocationLabel(locations[index]);
    }
    return null;
  }

  Future<void> _pickDate({required bool isRecurrenceEnd}) async {
    final picked = await showDatePicker(
      context: context,
      locale: const Locale('fr', 'FR'),
      initialDate: isRecurrenceEnd
          ? (_recurrenceEndDate ?? _seasonRecurrenceEndFor(_date))
          : _date,
      firstDate: isRecurrenceEnd ? _date : DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    if (picked == null) return;
    setState(() {
      if (isRecurrenceEnd) {
        _recurrenceEndDate = picked;
      } else {
        _date = picked;
        if (_recurrenceEndDate != null && _recurrenceEndDate!.isBefore(_date)) {
          _recurrenceEndDate = _seasonRecurrenceEndFor(_date);
        }
      }
    });
  }

  Future<void> _pickTime({
    required void Function(TimeOfDay) onPicked,
    required TimeOfDay initial,
  }) async {
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked != null) setState(() => onPicked(picked));
  }

  /// RDV = début − 30 min (borné à 00:00).
  TimeOfDay _meetingTimeFromStart(TimeOfDay start) {
    final totalMinutes = start.hour * 60 + start.minute - 30;
    final clamped = totalMinutes < 0 ? 0 : totalMinutes;
    return TimeOfDay(hour: clamped ~/ 60, minute: clamped % 60);
  }

  void _setStartTime(TimeOfDay start) {
    _start = start;
    if (!_meetingTimeManuallyEdited) {
      _meetingTime = _meetingTimeFromStart(start);
    }
  }

  void _setMeetingTime(TimeOfDay meeting) {
    _meetingTimeManuallyEdited = true;
    _meetingTime = meeting;
  }

  List<String> _audienceForTeam(ClubTeam team) {
    final members = ref.read(clubMembersProvider(widget.clubId)).value;
    if (members == null || members.isEmpty) {
      return {...team.playerIds, ...team.coachIds}.toList();
    }
    return audienceIdsForTeam(team, indexClubMembersByUid(members));
  }

  /// Compose le libellé lieu match extérieur (adresse, CP Ville).
  String? _resolveAwayLocation() {
    final address = _awayAddressController.text.trim();
    final city = _awayCityController.text.trim();
    final postal = _awayPostalController.text.trim();
    if (city.isEmpty || postal.isEmpty || address.isEmpty) return null;
    return '$address, $postal $city';
  }

  void _clearAwayAddressFields() {
    _awayCityController.clear();
    _awayPostalController.clear();
    _awayAddressController.clear();
  }

  String? _resolveLocation(Club? club) {
    if (_useAwayLocationField) {
      return _resolveAwayLocation();
    }
    final locations = club?.practiceLocations ?? const <PracticeLocation>[];
    final index = _selectedLocationIndex;
    if (index != null && index >= 0 && index < locations.length) {
      return _practiceLocationLabel(locations[index]);
    }
    final fallback = _locationController.text.trim();
    return fallback.isEmpty ? null : fallback;
  }

  /// Indique si tous les champs requis sont renseignés pour activer Créer.
  bool _canCreate(Club? club) {
    if (_type != EventTypes.other &&
        (_teamId == null || _teamId!.isEmpty)) {
      return false;
    }
    if (_type == EventTypes.other &&
        _titleController.text.trim().isEmpty) {
      return false;
    }
    if (_isMatch && _matchVenue == null) return false;

    final location = _resolveLocation(club);
    if (location == null || location.isEmpty) return false;

    if (!_isMatch) {
      final startMin = _start.hour * 60 + _start.minute;
      final endMin = _end.hour * 60 + _end.minute;
      if (endMin <= startMin) return false;
    }

    if (_isTraining && _isRecurring) {
      if (_recurrenceEndDate == null) return false;
      if (_recurrenceEndDate!.isBefore(_date)) return false;
    }

    final practiceLocations =
        club?.practiceLocations ?? const <PracticeLocation>[];
    if (practiceLocations.isNotEmpty &&
        _resolveMeetingLocation(club) == null) {
      return false;
    }

    return true;
  }

  Future<void> _save() async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null) return;

    final teams = ref.read(clubTeamsProvider(widget.clubId)).value ?? [];
    final club = ref.read(clubProvider(widget.clubId)).value;
    if (_type != EventTypes.other && _teamId == null) {
      ViroSnackBar.show(context, AppCopy.planning.chooseTeamSnack);
      return;
    }
    if (_type == EventTypes.other && _titleController.text.trim().isEmpty) {
      ViroSnackBar.show(context, AppCopy.planning.titleRequired);
      return;
    }

    if (_isMatch) {
      if (_matchVenue == null) {
        ViroSnackBar.show(context, AppCopy.planning.indicateHomeOrAway);
        return;
      }
      if (_matchVenue == MatchVenues.away &&
          _resolveAwayLocation() == null) {
        ViroSnackBar.show(
          context,
          AppCopy.planning.matchAddressRequired,
        );
        return;
      }
    } else if (!_isMatch) {
      final startMin = _start.hour * 60 + _start.minute;
      final endMin = _end.hour * 60 + _end.minute;
      if (endMin <= startMin) {
        ViroSnackBar.show(context, AppCopy.planning.endTimeAfterStart);
        return;
      }
    }

    if (_isRecurring) {
      if (_recurrenceEndDate == null) {
        ViroSnackBar.show(context, AppCopy.planning.chooseEndDate);
        return;
      }
      if (_recurrenceEndDate!.isBefore(_date)) {
        ViroSnackBar.show(context, AppCopy.planning.endDateAfterStart);
        return;
      }
    }

    ClubTeam? team;
    if (_teamId != null) {
      for (final t in teams) {
        if (t.id == _teamId) {
          team = t;
          break;
        }
      }
    }

    final location = _resolveLocation(club);
    if (location == null || location.isEmpty) {
      ViroSnackBar.show(context, AppCopy.planning.locationRequired);
      return;
    }

    setState(() => _saving = true);
    try {
      final count = await ref.read(eventServiceProvider).createEvents(
            clubId: widget.clubId,
            creatorId: uid,
            type: _type,
            title: _type == EventTypes.other
                ? _titleController.text.trim()
                : (team?.name ?? ''),
            startDate: _date,
            teamIds: team != null ? [team.id] : <String>[],
            teamMemberIds: team != null ? _audienceForTeam(team) : <String>[],
            allTeams: false,
            location: location,
            startTime: _formatTime(_start),
            endTime: _isMatch ? null : _formatTime(_end),
            meetingTime: _isMatch ? _formatTime(_meetingTime) : null,
            meetingLocation: _resolveMeetingLocation(club),
            matchVenue: _isMatch ? _matchVenue : null,
            recurrenceEndDate:
                _isTraining && _isRecurring ? _recurrenceEndDate : null,
          );
      if (mounted) {
        ViroSnackBar.show(
          context,
          AppCopy.planning.eventsCreated(count),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) ViroSnackBar.show(context, AppCopy.common.errorWithDetails(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _onTypeChanged(String? v) {
    final type = v ?? EventTypes.training;
    setState(() {
      _type = type;
      if (type == EventTypes.other) _teamId = null;
      if (type == EventTypes.match) {
        _isRecurring = false;
        _recurrenceEndDate = null;
        _matchVenue = MatchVenues.home;
        _locationController.clear();
        _clearAwayAddressFields();
      } else {
        _matchVenue = null;
        _clearAwayAddressFields();
      }
    });
  }

  void _onMatchVenueChanged(String? venue) {
    setState(() {
      _matchVenue = venue;
      if (venue == MatchVenues.home) {
        _locationController.clear();
        _clearAwayAddressFields();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final member = ref.watch(clubMemberProvider(widget.clubId)).value;
    if (member != null &&
        !MemberRoleHierarchy.isCoachOrAbove(member.role)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.pop();
      });
      return ViroScaffold(
        body: Center(child: Text(AppCopy.planning.reservedToCoachesAdmins)),
      );
    }

    final teamsAsync = ref.watch(clubTeamsProvider(widget.clubId));
    final clubAsync = ref.watch(clubProvider(widget.clubId));
    final accent = ref.watch(clubManagementAccentProvider(widget.clubId));
    final onAccent = accent.computeLuminance() > 0.55
        ? ViroColors.gray900
        : ViroColors.white;

    return ClubAccentTheme(
      accentColor: accent,
      child: ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: _saving ? null : () => context.pop(),
        ),
        title: Text(AppCopy.planning.newEventTitle),
      ),
      body: teamsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => const ViroErrorState(),
        data: (teams) {
          final club = clubAsync.value;
          if (club != null && !_locationDefaultsApplied) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted || _locationDefaultsApplied) return;
              setState(() => _applyLocationDefaults(club));
            });
          }

          final sortedTeams = _sortedTeams(teams, member);
          if (_teamId == null &&
              sortedTeams.isNotEmpty &&
              _type != EventTypes.other) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted && _teamId == null) {
                setState(() => _teamId = sortedTeams.first.id);
              }
            });
          }

          final dropdownStyle = Theme.of(context).textTheme.bodyMedium;
          final valueStyle = Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              );
          final practiceLocations =
              club?.practiceLocations ?? const <PracticeLocation>[];
          final selectedLocationValid = _selectedLocationIndex != null &&
              _selectedLocationIndex! >= 0 &&
              _selectedLocationIndex! < practiceLocations.length;
          final selectedMeetingLocationValid =
              _selectedMeetingLocationIndex != null &&
                  _selectedMeetingLocationIndex! >= 0 &&
                  _selectedMeetingLocationIndex! < practiceLocations.length;

          final bottomSafeInset = MediaQuery.paddingOf(context).bottom;
          const fadeHeight = ViroSpacing.lg;
          final saveBarHeight = fadeHeight +
              ViroSpacing.sm +
              ViroSpacing.buttonHeightLarge +
              ViroSpacing.md +
              bottomSafeInset;

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
              DropdownButtonFormField<String>(
                initialValue: _type,
                isDense: true,
                isExpanded: true,
                style: dropdownStyle,
                menuMaxHeight: 240,
                decoration: _inputDecoration(label: AppCopy.planning.fieldType),
                items: [
                  DropdownMenuItem(
                    value: EventTypes.training,
                    child: Text(AppCopy.planning.typeTraining, style: dropdownStyle),
                  ),
                  DropdownMenuItem(
                    value: EventTypes.match,
                    child: Text(AppCopy.planning.typeMatch, style: dropdownStyle),
                  ),
                  DropdownMenuItem(
                    value: EventTypes.other,
                    child: Text(AppCopy.planning.typeOther, style: dropdownStyle),
                  ),
                ],
                onChanged: _saving ? null : _onTypeChanged,
              ),
              const SizedBox(height: ViroSpacing.md),
              if (_type != EventTypes.other) ...[
                DropdownButtonFormField<String>(
                  key: ValueKey(
                    'team_${sortedTeams.map((t) => t.id).join('_')}_$_teamId',
                  ),
                  initialValue: sortedTeams.any((t) => t.id == _teamId)
                      ? _teamId
                      : null,
                  isDense: true,
                  isExpanded: true,
                  style: dropdownStyle,
                  menuMaxHeight: 240,
                  decoration: _inputDecoration(label: AppCopy.planning.fieldTeam),
                  hint: Text(AppCopy.planning.chooseTeam, style: dropdownStyle),
                  selectedItemBuilder: (context) => sortedTeams
                      .map(
                        (t) => Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: _teamDropdownRow(
                            team: t,
                            member: member,
                            style: dropdownStyle,
                          ),
                        ),
                      )
                      .toList(),
                  items: sortedTeams
                      .map(
                        (t) => DropdownMenuItem(
                          value: t.id,
                          child: _teamDropdownRow(
                            team: t,
                            member: member,
                            style: dropdownStyle,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged:
                      _saving ? null : (v) => setState(() => _teamId = v),
                ),
                const SizedBox(height: ViroSpacing.md),
              ] else ...[
                _FieldLabel(AppCopy.planning.fieldTitle, accentColor: accent),
                TextField(
                  controller: _titleController,
                  decoration: _inputDecoration(hint: AppCopy.planning.titleHint),
                  enabled: !_saving,
                ),
                const SizedBox(height: ViroSpacing.md),
              ],
              if (_isMatch) ...[
                _FieldLabel(AppCopy.planning.homeOrAway, accentColor: accent),
                SegmentedButton<String>(
                  style: ClubAccentTheme.segmentedButtonStyle(accent, onAccent),
                  segments: [
                    ButtonSegment(
                      value: MatchVenues.home,
                      label: Text(AppCopy.planning.home),
                    ),
                    ButtonSegment(
                      value: MatchVenues.away,
                      label: Text(AppCopy.planning.away),
                    ),
                  ],
                  selected: {_matchVenue ?? MatchVenues.home},
                  onSelectionChanged: _saving
                      ? null
                      : (s) => _onMatchVenueChanged(s.first),
                ),
                const SizedBox(height: ViroSpacing.md),
              ],
              if (_useAwayLocationField) ...[
                _FieldLabel(AppCopy.planning.matchVenue, accentColor: accent),
                FrenchAddressFields(
                  cityController: _awayCityController,
                  postalController: _awayPostalController,
                  addressController: _awayAddressController,
                  addressService: _addressService,
                  accent: accent,
                  enabled: !_saving,
                  addressLabel: AppCopy.planning.address,
                  addressHint: AppCopy.planning.addressHint,
                ),
                const SizedBox(height: ViroSpacing.md),
              ] else if (practiceLocations.isNotEmpty) ...[
                DropdownButtonFormField<int>(
                  key: ValueKey('loc_$_selectedLocationIndex'),
                  initialValue:
                      selectedLocationValid ? _selectedLocationIndex : null,
                  isDense: true,
                  isExpanded: true,
                  style: dropdownStyle,
                  menuMaxHeight: 240,
                  decoration: _inputDecoration(label: AppCopy.planning.fieldLocation),
                  selectedItemBuilder: (context) => [
                    for (final location in practiceLocations)
                      Text(
                        _practiceLocationLabel(location),
                        style: dropdownStyle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                  items: [
                    for (var i = 0; i < practiceLocations.length; i++)
                      DropdownMenuItem(
                        value: i,
                        child: Text(
                          _practiceLocationLabel(practiceLocations[i]),
                          style: dropdownStyle,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: _saving
                      ? null
                      : (v) => setState(() => _selectedLocationIndex = v),
                ),
                const SizedBox(height: ViroSpacing.md),
              ] else ...[
                _FieldLabel(AppCopy.planning.fieldLocation, accentColor: accent),
                TextField(
                  controller: _locationController,
                  decoration: _inputDecoration(hint: AppCopy.planning.locationHint),
                  enabled: !_saving,
                ),
                const SizedBox(height: ViroSpacing.md),
              ],
              ViroCard(
                margin: EdgeInsets.zero,
                padding: const EdgeInsets.all(ViroSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _PickValueRow(
                      label: _isMatch
                          ? AppCopy.planning.matchDay
                          : AppCopy.planning.date,
                      value: formatEventDate(_date),
                      valueStyle: valueStyle,
                      accentColor: accent,
                      trailing: ViroIcon(ViroIcons.calendar, color: accent),
                      onTap: _saving
                          ? null
                          : () => _pickDate(isRecurrenceEnd: false),
                    ),
                    const SizedBox(height: ViroSpacing.md),
                    if (_isMatch)
                      _PickValueRow(
                        label: AppCopy.planning.matchTime,
                        value: _formatTime(_start),
                        valueStyle: valueStyle,
                        accentColor: accent,
                        expand: false,
                        onTap: _saving
                            ? null
                            : () => _pickTime(
                                  initial: _start,
                                  onPicked: _setStartTime,
                                ),
                      )
                    else
                      Row(
                        children: [
                          _PickValueRow(
                            label: AppCopy.planning.start,
                            value: _formatTime(_start),
                            valueStyle: valueStyle,
                            accentColor: accent,
                            expand: false,
                            onTap: _saving
                                ? null
                                : () => _pickTime(
                                      initial: _start,
                                      onPicked: _setStartTime,
                                    ),
                          ),
                          const SizedBox(width: ViroSpacing.lg),
                          _PickValueRow(
                            label: AppCopy.planning.end,
                            value: _formatTime(_end),
                            valueStyle: valueStyle,
                            accentColor: accent,
                            expand: false,
                            onTap: _saving
                                ? null
                                : () => _pickTime(
                                      initial: _end,
                                      onPicked: (t) => _end = t,
                                    ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
              const SizedBox(height: ViroSpacing.md),
              if (_isMatch ||
                  _isTraining ||
                  practiceLocations.isNotEmpty)
                Theme(
                  data: Theme.of(context)
                      .copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    childrenPadding: EdgeInsets.zero,
                    initiallyExpanded: false,
                    title: Text(
                      AppCopy.planning.moreOptions,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: accent,
                          ),
                    ),
                    subtitle: Text(
                      AppCopy.planning.moreOptionsSubtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: ViroColors.gray600,
                          ),
                    ),
                    children: [
                      if (_isMatch) ...[
                        _PickValueRow(
                          label: AppCopy.planning.meetingTime,
                          value: _formatTime(_meetingTime),
                          valueStyle: valueStyle,
                          accentColor: accent,
                          onTap: _saving
                              ? null
                              : () => _pickTime(
                                    initial: _meetingTime,
                                    onPicked: _setMeetingTime,
                                  ),
                        ),
                        const SizedBox(height: ViroSpacing.md),
                      ],
                      if (_isTraining) ...[
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            AppCopy.planning.weeklyRecurrence,
                            style:
                                const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          value: _isRecurring,
                          onChanged: _saving
                              ? null
                              : (v) => setState(() {
                                    _isRecurring = v;
                                    if (v && _recurrenceEndDate == null) {
                                      _recurrenceEndDate =
                                          _seasonRecurrenceEndFor(_date);
                                    }
                                  }),
                        ),
                        if (_isRecurring) ...[
                          const SizedBox(height: ViroSpacing.sm),
                          _PickValueRow(
                            label: AppCopy.planning.seasonEnd,
                            value: _recurrenceEndDate != null
                                ? DateFormat('EEEE dd/MM/yyyy', 'fr_FR')
                                    .format(_recurrenceEndDate!)
                                : AppCopy.planning.chooseDate,
                            valueStyle: valueStyle,
                            accentColor: accent,
                            subtitle:
                                AppCopy.planning.seasonEndDefaultSubtitle,
                            trailing: ViroIcon(
                              ViroIcons.calendar,
                              color: accent,
                            ),
                            onTap: _saving
                                ? null
                                : () => _pickDate(isRecurrenceEnd: true),
                          ),
                          const SizedBox(height: ViroSpacing.md),
                        ],
                      ],
                      if (practiceLocations.isNotEmpty)
                        DropdownButtonFormField<int>(
                          key: ValueKey('rdv_$_selectedMeetingLocationIndex'),
                          initialValue: selectedMeetingLocationValid
                              ? _selectedMeetingLocationIndex
                              : null,
                          isDense: true,
                          isExpanded: true,
                          style: dropdownStyle,
                          menuMaxHeight: 240,
                          decoration: _inputDecoration(
                            label: AppCopy.planning.meetingLocation,
                          ),
                          selectedItemBuilder: (context) => [
                            for (final location in practiceLocations)
                              Text(
                                _practiceLocationLabel(location),
                                style: dropdownStyle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                          ],
                          items: [
                            for (var i = 0;
                                i < practiceLocations.length;
                                i++)
                              DropdownMenuItem(
                                value: i,
                                child: Text(
                                  _practiceLocationLabel(
                                    practiceLocations[i],
                                  ),
                                  style: dropdownStyle,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: _saving
                              ? null
                              : (v) => setState(
                                    () => _selectedMeetingLocationIndex = v,
                                  ),
                        ),
                    ],
                  ),
                ),
                ],
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IgnorePointer(
                      child: SizedBox(
                        height: fadeHeight,
                        width: double.infinity,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                ViroColors.white.withValues(alpha: 0),
                                ViroColors.white,
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    ColoredBox(
                      color: ViroColors.white,
                      child: SafeArea(
                        top: false,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(
                            ViroSpacing.screenHorizontal,
                            ViroSpacing.sm,
                            ViroSpacing.screenHorizontal,
                            ViroSpacing.md,
                          ),
                          child: ViroPrimaryButton(
                            label: _isRecurring && _isTraining
                                ? AppCopy.planning.createSeries
                                : AppCopy.planning.createEvent,
                            isLoading: _saving,
                            onPressed: _saving || !_canCreate(club)
                                ? null
                                : _save,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
      ),
    );
  }

  InputDecoration _inputDecoration({String? hint, String? label}) =>
      InputDecoration(
        hintText: hint,
        labelText: label,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm + 2,
        ),
        filled: true,
        fillColor: ViroColors.surfaceCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
          borderSide: BorderSide(color: ViroColors.primary100),
        ),
      );
}

/// Ligne cliquable label + valeur (date / heure), sans hauteur ListTile.
class _PickValueRow extends StatelessWidget {
  const _PickValueRow({
    required this.label,
    required this.value,
    required this.valueStyle,
    required this.accentColor,
    this.subtitle,
    this.trailing,
    this.expand = true,
    this.onTap,
  });

  final String label;
  final String value;
  final TextStyle? valueStyle;
  final Color accentColor;
  final String? subtitle;
  final Widget? trailing;
  final bool expand;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final labelColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: accentColor,
              ),
        ),
        const SizedBox(height: ViroSpacing.xs),
        Text(value, style: valueStyle),
        if (subtitle != null) ...[
          const SizedBox(height: ViroSpacing.xs),
          Text(
            subtitle!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: ViroColors.primary600,
                ),
          ),
        ],
      ],
    );

    return ViroPressable(
      onTap: onTap,
      enabled: onTap != null,
      floating: false,
      borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: ViroSpacing.sm),
        child: Row(
          mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (expand) Expanded(child: labelColumn) else labelColumn,
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text, {this.accentColor});

  final String text;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.xs),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
              color: accentColor ?? ViroColors.primary800,
            ),
      ),
    );
  }
}
