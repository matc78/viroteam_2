import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club_setup/practice_location_categories.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_format.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_ui.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_step_shell.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/utils/person_data_format.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Étape lieux de pratique — catégorie + ville + chips retirables.
class PracticeLocationsStep extends StatefulWidget {
  const PracticeLocationsStep({
    super.key,
    required this.sport,
    required this.fallbackCity,
    required this.locations,
    required this.onAdd,
    required this.onRemove,
    this.onValidationError,
  });

  final String sport;
  final String fallbackCity;
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

  void _submit() {
    final city = _cityController.text.trim().isEmpty
        ? widget.fallbackCity.trim()
        : _cityController.text.trim();
    final custom = _customCategoryController.text.trim();
    if (_category == PracticeLocationCategories.other && custom.isEmpty) {
      widget.onValidationError?.call('Précisez le type de lieu.');
      return;
    }
    if (city.isEmpty) {
      widget.onValidationError?.call('Indiquez la ville du lieu.');
      return;
    }
    final cityValidationError = cityError(city);
    if (cityValidationError != null) {
      widget.onValidationError?.call(cityValidationError);
      return;
    }
    final addressValidationError = addressLineError(_addressController.text);
    if (addressValidationError != null) {
      widget.onValidationError?.call(addressValidationError);
      return;
    }

    final formattedCity = formatCity(city);
    final formattedAddress = _addressController.text.trim().isEmpty
        ? null
        : formatAddressLine(_addressController.text);

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
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    const accent = ViroColors.sportOrange;
    final categories = PracticeLocationCategories.forSport(widget.sport);
    final manualLocations = [
      for (var index = 0; index < widget.locations.length; index++)
        if (!widget.locations[index].linkedToHeadquarters)
          (index: index, location: widget.locations[index]),
    ];
    final hasHeadquarters = widget.locations.any((l) => l.linkedToHeadquarters);

    return SetupStepShell(
      centerBody: true,
      subtitle: hasHeadquarters
          ? 'Ajoutez d\'autres lieux si besoin (optionnel si le siège suffit).'
          : 'Ajoutez au moins un lieu de pratique.',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.locations.isNotEmpty) ...[
            SizedBox(
              height: 36,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: widget.locations.length,
              separatorBuilder: (context, index) =>
                  const SizedBox(width: ViroSpacing.xs),
                itemBuilder: (context, index) {
                  final location = widget.locations[index];
                  final chipAccent = ClubSetupUi.sportAccents[
                      index % ClubSetupUi.sportAccents.length];
                  return _LocationChip(
                    label: location.name,
                    accent: chipAccent,
                    linked: location.linkedToHeadquarters,
                    onRemove: location.linkedToHeadquarters
                        ? null
                        : () => widget.onRemove(index),
                  );
                },
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
          ],
          Text(
            'Type de lieu',
            style: theme.labelMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: ViroColors.primary800,
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
                        fontWeight:
                            selected ? FontWeight.w700 : FontWeight.w500,
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
              decoration: const InputDecoration(
                labelText: 'Précisez le type',
                isDense: true,
              ),
              onChanged: (_) => setState(() {}),
            ),
          ],
          const SizedBox(height: ViroSpacing.sm),
          TextFormField(
            controller: _cityController,
            decoration: const InputDecoration(
              labelText: 'Ville du lieu',
              isDense: true,
            ),
          ),
          const SizedBox(height: ViroSpacing.xs),
          TextFormField(
            controller: _addressController,
            decoration: const InputDecoration(
              labelText: 'Adresse (optionnel)',
              isDense: true,
            ),
          ),
          const SizedBox(height: ViroSpacing.sm),
          Align(
            alignment: Alignment.centerLeft,
            child: ElevatedButton.icon(
              onPressed: _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: accent,
                foregroundColor: ViroColors.white,
                minimumSize: const Size(0, ViroSpacing.xl),
                padding: const EdgeInsets.symmetric(
                  horizontal: ViroSpacing.sm,
                  vertical: ViroSpacing.xs,
                ),
              ),
              icon: ViroIcon(ViroIcons.add, size: 14, color: ViroColors.white),
              label: Text(
                manualLocations.isEmpty && !hasHeadquarters
                    ? 'Ajouter ce lieu'
                    : 'Ajouter un autre lieu',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LocationChip extends StatelessWidget {
  const _LocationChip({
    required this.label,
    required this.accent,
    required this.linked,
    this.onRemove,
  });

  final String label;
  final Color accent;
  final bool linked;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(left: ViroSpacing.sm, right: 4),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (linked) ...[
            ViroIcon(ViroIcons.place, size: 12, color: accent),
            const SizedBox(width: 4),
          ],
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 140),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: accent,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          if (onRemove != null)
            ViroPressable(
              onTap: onRemove,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: ViroIcon(ViroIcons.close, size: 14, color: accent),
              ),
            )
          else
            const SizedBox(width: 8),
        ],
      ),
    );
  }
}
