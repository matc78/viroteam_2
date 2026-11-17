import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_helpers.dart';
import 'package:viro_team_v2/features/planning/utils/edit_event_form_controller.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_field_label.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_pick_value_row.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_schedule_card.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Sheet coach : modifie date, heures, lieux (et titre sans équipe) d'une
/// occurrence. Les convoqués sont prévenus par le trigger push.
class PlanningEditEventSheet extends ConsumerStatefulWidget {
  const PlanningEditEventSheet({
    super.key,
    required this.clubId,
    required this.event,
    required this.scrollController,
  });

  final String clubId;
  final ClubEvent event;
  final ScrollController scrollController;

  /// Ouvre la sheet. Retourne `true` si l'événement a été modifié.
  static Future<bool> show({
    required BuildContext context,
    required String clubId,
    required ClubEvent event,
  }) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => Consumer(
        builder: (context, sheetRef, _) {
          final accent = sheetRef.watch(clubMemberAccentProvider(clubId));
          return ClubAccentTheme(
            accentColor: accent,
            child: DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.85,
              minChildSize: 0.5,
              maxChildSize: 0.95,
              builder: (_, scrollController) => PlanningEditEventSheet(
                clubId: clubId,
                event: event,
                scrollController: scrollController,
              ),
            ),
          );
        },
      ),
    );
    return saved == true;
  }

  @override
  ConsumerState<PlanningEditEventSheet> createState() =>
      _PlanningEditEventSheetState();
}

class _PlanningEditEventSheetState
    extends ConsumerState<PlanningEditEventSheet> {
  late final EditEventFormController _form;

  @override
  void initState() {
    super.initState();
    _form = EditEventFormController(widget.event);
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

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      locale: const Locale('fr', 'FR'),
      initialDate: _form.date,
      firstDate: DateTime(now.year - 1, now.month, now.day),
      lastDate: DateTime(now.year + 2, now.month, now.day),
    );
    if (picked != null) _form.setDate(picked);
  }

  Future<void> _pickTime({
    required TimeOfDay initial,
    required void Function(TimeOfDay) onPicked,
  }) async {
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked != null) onPicked(picked);
  }

  Future<void> _save() async {
    if (_form.saving) return;
    if (!_form.hasChanges) {
      Navigator.pop(context, false);
      return;
    }
    try {
      final saved = await _form.save(
        clubId: widget.clubId,
        eventService: ref.read(eventServiceProvider),
      );
      if (!saved || !mounted) return;
      Navigator.pop(context, true);
      ViroSnackBar.show(context, AppCopy.planning.eventUpdated);
    } catch (_) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.planning.eventUpdateFailed);
      }
    }
  }

  /// Lieu : dropdown des lieux club + « Autre », ou saisie libre (extérieur / aucun lieu).
  List<Widget> _buildLocationFields({
    required ViroPalette palette,
    required Color accent,
    required bool enabled,
    required TextStyle? dropdownStyle,
  }) {
    final club = ref.watch(clubProvider(widget.clubId)).value;
    final practiceLocations = club?.practiceLocations ?? const [];
    if (!_form.locationSelectionSeeded) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _form.seedLocationSelection(practiceLocations);
      });
    }

    final useDropdown = !_form.isAwayMatch && practiceLocations.isNotEmpty;
    final showCustom = _form.showCustomLocationField(practiceLocations);
    final selectedValid = _form.selectedLocationIndex != null &&
        _form.selectedLocationIndex! >= 0 &&
        _form.selectedLocationIndex! < practiceLocations.length;
    final dropdownValue = useDropdown
        ? (selectedValid
            ? _form.selectedLocationIndex
            : addEventLocationOtherIndex)
        : null;

    return [
      if (useDropdown) ...[
        AddEventFieldLabel(
          AppCopy.planning.fieldLocation,
          accentColor: accent,
        ),
        DropdownButtonFormField<int>(
          key: ValueKey('edit_loc_${_form.selectedLocationIndex}'),
          initialValue: dropdownValue,
          isDense: true,
          isExpanded: true,
          style: dropdownStyle,
          iconEnabledColor: palette.textPrimary,
          menuMaxHeight: 240,
          decoration: addEventInputDecoration(palette: palette),
          selectedItemBuilder: (context) => [
            for (final location in practiceLocations)
              Text(
                addEventPracticeLocationLabel(location),
                style: dropdownStyle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            Text(
              AppCopy.planning.locationOther,
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
                  addEventPracticeLocationLabel(practiceLocations[i]),
                  style: dropdownStyle,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            DropdownMenuItem(
              value: addEventLocationOtherIndex,
              child: Text(
                AppCopy.planning.locationOther,
                style: dropdownStyle,
              ),
            ),
          ],
          onChanged: enabled
              ? (index) =>
                  _form.setSelectedLocationIndex(index, practiceLocations)
              : null,
        ),
      ],
      if (useDropdown && showCustom) const SizedBox(height: ViroSpacing.md),
      if (showCustom) ...[
        AddEventFieldLabel(
          useDropdown
              ? AppCopy.planning.locationSpecify
              : AppCopy.planning.fieldLocation,
          accentColor: accent,
        ),
        TextField(
          controller: _form.locationController,
          decoration: addEventInputDecoration(
            palette: palette,
            hint: AppCopy.planning.locationHint,
          ),
          enabled: enabled,
        ),
      ],
      const SizedBox(height: ViroSpacing.md),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final accent = Theme.of(context).colorScheme.primary;
    final enabled = !_form.saving;
    final blockingReason = _form.blockingReason;
    final valueStyle = theme.titleMedium?.copyWith(fontWeight: FontWeight.w600);

    return Column(
      children: [
        const SizedBox(height: ViroSpacing.sm),
        Container(
          width: 40,
          height: 4,
          decoration: BoxDecoration(
            color: palette.border,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        Expanded(
          child: ListView(
            controller: widget.scrollController,
            padding: EdgeInsets.fromLTRB(
              ViroSpacing.screenHorizontal,
              ViroSpacing.md,
              ViroSpacing.screenHorizontal,
              ViroSpacing.xl + MediaQuery.viewInsetsOf(context).bottom,
            ),
            children: [
              Row(
                children: [
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: ViroSpacing.minTouchTarget,
                      minHeight: ViroSpacing.minTouchTarget,
                    ),
                    tooltip: AppCopy.common.back,
                    icon: ViroIcon(
                      ViroIcons.chevronLeft,
                      color: palette.textSecondary,
                    ),
                    onPressed: _form.saving
                        ? null
                        : () => Navigator.pop(context, false),
                  ),
                  Expanded(
                    child: Text(
                      AppCopy.planning.editEventTitle,
                      style: theme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: palette.brandText,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: ViroSpacing.xs),
              Text(
                widget.event.isRecurringSeries
                    ? '${AppCopy.planning.editEventSubtitle} '
                        '${AppCopy.planning.editSeriesOccurrenceHint}'
                    : AppCopy.planning.editEventSubtitle,
                style: theme.bodySmall?.copyWith(color: palette.textSecondary),
              ),
              const SizedBox(height: ViroSpacing.md),
              if (_form.hasEditableTitle) ...[
                AddEventFieldLabel(
                  widget.event.type == EventTypes.meeting
                      ? AppCopy.planning.fieldTitleOptional
                      : AppCopy.planning.fieldTitle,
                  accentColor: accent,
                ),
                TextField(
                  controller: _form.titleController,
                  decoration: addEventInputDecoration(
                    palette: palette,
                    hint: widget.event.type == EventTypes.meeting
                        ? AppCopy.planning.meetingTitleHint
                        : AppCopy.planning.titleHint,
                  ),
                  enabled: enabled,
                ),
                const SizedBox(height: ViroSpacing.md),
              ],
              AddEventScheduleCard(
                isMatch: _form.isMatch,
                date: _form.date,
                start: _form.start,
                end: _form.end,
                accentColor: accent,
                enabled: enabled,
                onPickDate: _pickDate,
                onPickStart: () => _pickTime(
                  initial: _form.start,
                  onPicked: _form.setStartTime,
                ),
                onPickEnd: () =>
                    _pickTime(initial: _form.end, onPicked: _form.setEndTime),
              ),
              if (_form.isMatch)
                AddEventPickValueRow(
                  label: AppCopy.planning.meetingTime,
                  value: addEventFormatTime(_form.meetingTime),
                  valueStyle: valueStyle,
                  accentColor: accent,
                  expand: false,
                  onTap: enabled
                      ? () => _pickTime(
                            initial: _form.meetingTime,
                            onPicked: _form.setMeetingTime,
                          )
                      : null,
                ),
              const SizedBox(height: ViroSpacing.md),
              ..._buildLocationFields(
                palette: palette,
                accent: accent,
                enabled: enabled,
                dropdownStyle: theme.bodyMedium?.copyWith(
                  color: palette.textPrimary,
                ),
              ),
              AddEventFieldLabel(
                AppCopy.planning.meetingLocationOptional,
                accentColor: accent,
              ),
              TextField(
                controller: _form.meetingLocationController,
                decoration: addEventInputDecoration(palette: palette),
                enabled: enabled,
              ),
              const SizedBox(height: ViroSpacing.lg),
              if (blockingReason != null) ...[
                Text(
                  blockingReason,
                  style: theme.bodySmall?.copyWith(color: palette.textSecondary),
                ),
                const SizedBox(height: ViroSpacing.sm),
              ],
              ViroPrimaryButton(
                label: _form.saving
                    ? AppCopy.common.loading
                    : AppCopy.common.save,
                isLoading: _form.saving,
                onPressed: _form.saving || blockingReason != null
                    ? null
                    : _save,
              ),
              SizedBox(height: MediaQuery.paddingOf(context).bottom),
            ],
          ),
        ),
      ],
    );
  }
}
