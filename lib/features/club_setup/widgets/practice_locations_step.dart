import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club_setup/club_setup_steps.dart';
import 'package:viro_team_v2/features/club_setup/practice_location_categories.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_format.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_ui.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_step_shell.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/utils/person_data_format.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Étape lieux d'entraînement/match — formulaire, option siège, puis récap.
class PracticeLocationsStep extends StatefulWidget {
  const PracticeLocationsStep({
    super.key,
    required this.sport,
    required this.fallbackCity,
    required this.hasClubStreetAddress,
    required this.useClubAddressAsFirstLocation,
    required this.onUseClubAddressChanged,
    required this.locations,
    required this.onAdd,
    required this.onRemove,
    this.onValidationError,
  });

  final String sport;
  final String fallbackCity;
  final bool hasClubStreetAddress;
  final bool useClubAddressAsFirstLocation;
  final void Function(bool value) onUseClubAddressChanged;
  final List<PracticeLocation> locations;
  final void Function(PracticeLocation location) onAdd;
  final void Function(int index) onRemove;
  final void Function(String message)? onValidationError;

  @override
  State<PracticeLocationsStep> createState() => _PracticeLocationsStepState();
}

class _PracticeLocationsStepState extends State<PracticeLocationsStep> {
  late String _category;
  late final TextEditingController _cityController;
  late final TextEditingController _customCategoryController;
  late final TextEditingController _addressController;

  @override
  void initState() {
    super.initState();
    _category = PracticeLocationCategories.defaultForSport(widget.sport);
    _cityController = TextEditingController(text: widget.fallbackCity);
    _customCategoryController = TextEditingController();
    _addressController = TextEditingController();
  }

  @override
  void didUpdateWidget(covariant PracticeLocationsStep oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.sport != widget.sport) {
      final categories = PracticeLocationCategories.forSport(widget.sport);
      if (!categories.contains(_category)) {
        setState(() {
          _category = PracticeLocationCategories.defaultForSport(widget.sport);
        });
      }
    }
    if (oldWidget.fallbackCity != widget.fallbackCity &&
        _cityController.text.trim().isEmpty) {
      _cityController.text = widget.fallbackCity;
    }
  }

  @override
  void dispose() {
    _cityController.dispose();
    _customCategoryController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  /// Indique si le formulaire manuel est prêt à être soumis.
  bool get _canSubmit {
    final city = _cityController.text.trim().isEmpty
        ? widget.fallbackCity.trim()
        : _cityController.text.trim();
    final address = _addressController.text.trim();
    if (city.isEmpty || address.isEmpty) return false;
    if (cityError(city) != null) return false;
    if (addressLineError(address) != null) return false;
    if (_category == PracticeLocationCategories.other &&
        _customCategoryController.text.trim().isEmpty) {
      return false;
    }
    return true;
  }

  void _submit() {
    if (!_canSubmit) return;

    final city = _cityController.text.trim().isEmpty
        ? widget.fallbackCity.trim()
        : _cityController.text.trim();
    final custom = _customCategoryController.text.trim();
    final formattedCity = formatCity(city);
    final formattedAddress = formatAddressLine(_addressController.text);

    final location = PracticeLocation(
      name: ClubSetupFormat.practiceLocationName(
        category: _category,
        city: formattedCity,
        categoryCustom:
            _category == PracticeLocationCategories.other ? custom : null,
      ),
      city: formattedCity,
      address: formattedAddress,
      category: _category,
      categoryCustom:
          _category == PracticeLocationCategories.other ? custom : null,
    );
    widget.onAdd(location);
    _addressController.clear();
    if (_category == PracticeLocationCategories.other) {
      _customCategoryController.clear();
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final accent = ClubSetupUi.stepAccent(ClubSetupSteps.practiceLocations);
    final categories = PracticeLocationCategories.forSport(widget.sport);
    final hasManualLocations =
        widget.locations.any((location) => !location.linkedToHeadquarters);
    final hasHeadquarters =
        widget.locations.any((location) => location.linkedToHeadquarters);
    final canSubmit = _canSubmit;

    return SetupStepShell(
      centerBody: false,
      subtitle: hasHeadquarters
          ? AppCopy.clubSetup.practiceSubtitleOther
          : AppCopy.clubSetup.practiceSubtitleFirst,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
          ViroCard(
            elevated: false,
            margin: EdgeInsets.zero,
            padding: const EdgeInsets.all(ViroSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  AppCopy.clubSetup.newLocation,
                  style: theme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: ViroColors.primary800,
                  ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                Text(
                  AppCopy.clubSetup.locationTypeLabel,
                  style: theme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: ViroColors.gray600,
                  ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                SizedBox(
                  height: 34,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: categories.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(width: ViroSpacing.xs),
                    itemBuilder: (context, index) {
                      final category = categories[index];
                      final selected = _category == category;
                      return ViroPressable(
                        onTap: () => setState(() => _category = category),
                        borderRadius: BorderRadius.circular(16),
                        child: AnimatedContainer(
                          duration: ViroMotion.fast,
                          padding: const EdgeInsets.symmetric(
                            horizontal: ViroSpacing.sm,
                            vertical: ViroSpacing.xs,
                          ),
                          decoration: BoxDecoration(
                            color: selected
                                ? accent.withValues(alpha: 0.14)
                                : ViroColors.surfaceCard,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: selected ? accent : ViroColors.primary100,
                              width: selected ? 2 : 1,
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            PracticeLocationCategories.label(category),
                            style: theme.labelSmall?.copyWith(
                              color: selected ? accent : ViroColors.gray600,
                              fontWeight: selected
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                if (_category == PracticeLocationCategories.other) ...[
                  const SizedBox(height: ViroSpacing.xs),
                  TextFormField(
                    controller: _customCategoryController,
                    decoration: InputDecoration(
                      labelText: AppCopy.clubSetup.specifyType,
                      isDense: true,
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ],
                const SizedBox(height: ViroSpacing.sm),
                TextFormField(
                  controller: _cityController,
                  decoration: InputDecoration(
                    labelText: AppCopy.clubSetup.cityLabel,
                    isDense: true,
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: ViroSpacing.xs),
                TextFormField(
                  controller: _addressController,
                  decoration: InputDecoration(
                    labelText: AppCopy.clubSetup.addressLabel,
                    isDense: true,
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: ViroSpacing.sm),
                Align(
                  alignment: Alignment.centerLeft,
                  child: AnimatedOpacity(
                    duration: ViroMotion.fast,
                    opacity: canSubmit ? 1 : 0.45,
                    child: ElevatedButton.icon(
                      onPressed: canSubmit ? _submit : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: ViroColors.white,
                        disabledBackgroundColor:
                            accent.withValues(alpha: 0.35),
                        disabledForegroundColor: ViroColors.white,
                        minimumSize: const Size(0, ViroSpacing.xl),
                        padding: const EdgeInsets.symmetric(
                          horizontal: ViroSpacing.sm,
                          vertical: ViroSpacing.xs,
                        ),
                      ),
                      icon: ViroIcon(
                        ViroIcons.add,
                        size: 14,
                        color: ViroColors.white,
                      ),
                      label: Text(
                        hasManualLocations || hasHeadquarters
                            ? AppCopy.clubSetup.addAnotherLocation
                            : AppCopy.clubSetup.addThisLocation,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: ViroSpacing.sm),
          _UseClubAddressOption(
            selected: widget.useClubAddressAsFirstLocation,
            hasStreetAddress: widget.hasClubStreetAddress,
            onChanged: widget.onUseClubAddressChanged,
          ),
          if (widget.locations.isNotEmpty) ...[
            const SizedBox(height: ViroSpacing.md),
            Text(
              AppCopy.clubSetup.locationsAdded,
              style: theme.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: ViroColors.primary800,
              ),
            ),
            const SizedBox(height: ViroSpacing.xs),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var index = 0; index < widget.locations.length; index++) ...[
                  if (index > 0) const SizedBox(height: ViroSpacing.xs),
                  _LocationChip(
                    location: widget.locations[index],
                    accent: accent,
                    onRemove: widget.locations[index].linkedToHeadquarters
                        ? () => widget.onUseClubAddressChanged(false)
                        : () => widget.onRemove(index),
                  ),
                ],
              ],
            ),
          ],
        ],
        ),
      ),
    );
  }
}

class _UseClubAddressOption extends StatelessWidget {
  const _UseClubAddressOption({
    required this.selected,
    required this.hasStreetAddress,
    required this.onChanged,
  });

  final bool selected;
  final bool hasStreetAddress;
  final void Function(bool value) onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final accent = ClubSetupUi.stepAccent(ClubSetupSteps.practiceLocations);

    return ViroCard(
      onTap: () => onChanged(!selected),
      elevated: false,
      margin: EdgeInsets.zero,
      padding: EdgeInsets.zero,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.sm,
                  ViroSpacing.sm,
                  ViroSpacing.xs,
                  ViroSpacing.sm,
                ),
                child: Text(
                  hasStreetAddress
                      ? AppCopy.clubSetup.useHeadquartersAddress
                      : AppCopy.clubSetup.useHeadquartersCity,
                  style: theme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: ViroColors.primary800,
                    height: 1.25,
                  ),
                ),
              ),
            ),
            SizedBox(
              width: 40,
              child: AnimatedContainer(
                duration: ViroMotion.fast,
                curve: ViroMotion.enter,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected ? accent : ViroColors.white,
                  border: Border(
                    left: BorderSide(
                      color: selected ? accent : ViroColors.gray200,
                    ),
                  ),
                ),
                child: selected
                    ? ViroIcon(
                        ViroIcons.check,
                        color: ViroColors.white,
                        size: 18,
                      )
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LocationChip extends StatelessWidget {
  const _LocationChip({
    required this.location,
    required this.accent,
    this.onRemove,
  });

  final PracticeLocation location;
  final Color accent;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final categoryLabel = location.category == null
        ? null
        : PracticeLocationCategories.label(
            location.category!,
            location.categoryCustom,
          );
    final cityLabel = location.city?.trim() ?? '';
    final addressLabel = ClubSetupFormat.streetAddressForDisplay(
      address: location.address,
      city: cityLabel,
    );
    final details = [cityLabel, addressLabel]
        .where((part) => part.isNotEmpty)
        .join(' · ');
    final detailsLabel = details.isNotEmpty ? details : location.name;

    return Container(
      padding: EdgeInsets.zero,
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withValues(alpha: 0.45)),
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.sm,
                  ViroSpacing.sm,
                  ViroSpacing.xs,
                  ViroSpacing.sm,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: ViroIcon(ViroIcons.place, size: 12, color: accent),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (categoryLabel != null && categoryLabel.isNotEmpty)
                            Text(
                              categoryLabel,
                              softWrap: true,
                              style: theme.labelSmall?.copyWith(
                                color: accent,
                                fontWeight: FontWeight.w700,
                                height: 1.25,
                              ),
                            ),
                          Text(
                            detailsLabel,
                            softWrap: true,
                            style: theme.labelSmall?.copyWith(
                              color: ViroColors.primary800,
                              fontWeight: FontWeight.w500,
                              height: 1.25,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (onRemove != null)
              ViroPressable(
                onTap: onRemove,
                floating: false,
                minSize: 40,
                borderRadius: BorderRadius.zero,
                child: Container(
                  width: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.18),
                    border: Border(
                      left: BorderSide(color: accent.withValues(alpha: 0.45)),
                    ),
                  ),
                  child: ViroIcon(ViroIcons.close, size: 18, color: accent),
                ),
              )
            else
              const SizedBox(width: 8),
          ],
        ),
      ),
    );
  }
}
