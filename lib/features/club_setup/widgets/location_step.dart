import 'dart:async';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club_setup/services/french_address_service.dart';
import 'package:viro_team_v2/features/club_setup/widgets/practice_location_tile.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_step_shell.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Étape localisation — adresse du club et lieux de pratique.
class LocationStep extends StatelessWidget {
  const LocationStep({
    super.key,
    required this.cityController,
    required this.postalController,
    required this.addressController,
    required this.locationNameController,
    required this.locationAddressController,
    required this.locations,
    required this.onFieldChanged,
    required this.onAddLocation,
    required this.onRemoveLocation,
    required this.addressService,
    required this.useClubAddressAsFirstLocation,
    required this.onUseClubAddressChanged,
  });

  final TextEditingController cityController;
  final TextEditingController postalController;
  final TextEditingController addressController;
  final TextEditingController locationNameController;
  final TextEditingController locationAddressController;
  final List<PracticeLocation> locations;
  final VoidCallback onFieldChanged;
  final VoidCallback onAddLocation;
  final void Function(int index) onRemoveLocation;
  final FrenchAddressService addressService;
  final bool useClubAddressAsFirstLocation;
  final void Function(bool value) onUseClubAddressChanged;

  @override
  Widget build(BuildContext context) {
    final hasStreetAddress = addressController.text.trim().isNotEmpty;
    final addLocationLabel = useClubAddressAsFirstLocation
        ? (hasStreetAddress
            ? 'Ajouter l\'adresse du club'
            : 'Ajouter la ville du club')
        : 'Ajouter ce lieu';

    return SetupStepShell(
      subtitle: 'Siège du club et lieux de pratique.',
      child: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: _AddressAutocompleteField(
                    controller: cityController,
                    label: 'Ville',
                    hint: 'Ex. Viroflay',
                    addressService: addressService,
                    onChanged: onFieldChanged,
                    onSuggestionSelected: (suggestion) {
                      cityController.text = suggestion.city;
                      postalController.text = suggestion.postalCode;
                      if (suggestion.street.isNotEmpty) {
                        addressController.text = suggestion.street;
                      }
                      onFieldChanged();
                    },
                  ),
                ),
                const SizedBox(width: ViroSpacing.sm),
                Expanded(
                  flex: 2,
                  child: TextFormField(
                    controller: postalController,
                    decoration: const InputDecoration(
                      labelText: 'Code postal',
                      hintText: '78220',
                      isDense: true,
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (_) => onFieldChanged(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ViroSpacing.sm),
            _AddressAutocompleteField(
              controller: addressController,
              label: 'Adresse du club',
              hint: '183 avenue du Général Leclerc',
              addressService: addressService,
              onChanged: onFieldChanged,
              onSuggestionSelected: (suggestion) {
                cityController.text = suggestion.city;
                postalController.text = suggestion.postalCode;
                addressController.text = suggestion.street;
                onFieldChanged();
              },
            ),
            const SizedBox(height: ViroSpacing.sm),
            Text(
              'Lieux de pratique',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: ViroColors.primary800,
                  ),
            ),
            const SizedBox(height: ViroSpacing.xs),
            _UseClubAddressOption(
              selected: useClubAddressAsFirstLocation,
              hasStreetAddress: hasStreetAddress,
              onChanged: onUseClubAddressChanged,
            ),
            const SizedBox(height: ViroSpacing.xs),
            TextFormField(
              controller: locationNameController,
              style: Theme.of(context).textTheme.labelSmall,
              decoration: _compactLocationFieldDecoration(
                context,
                label: 'Nom du lieu',
                hint: 'Ex. Stade municipal',
              ),
            ),
            const SizedBox(height: ViroSpacing.xs),
            TextFormField(
              controller: locationAddressController,
              style: Theme.of(context).textTheme.labelSmall,
              decoration: _compactLocationFieldDecoration(
                context,
                label: 'Adresse du lieu (optionnel)',
                hint: 'Si différente du siège',
              ),
            ),
            const SizedBox(height: ViroSpacing.xs),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: onAddLocation,
                style: OutlinedButton.styleFrom(
                  minimumSize: Size(0, ViroSpacing.xl),
                  padding: const EdgeInsets.symmetric(
                    horizontal: ViroSpacing.sm,
                    vertical: ViroSpacing.xs,
                  ),
                  textStyle: Theme.of(context).textTheme.labelSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                  side: const BorderSide(color: ViroColors.primary600),
                ),
                icon: ViroIcon(ViroIcons.add, size: 14),
                label: Text(addLocationLabel),
              ),
            ),
            if (locations.isNotEmpty) ...[
              const SizedBox(height: ViroSpacing.sm),
              AnimatedSize(
                duration: ViroMotion.standard,
                curve: ViroMotion.enter,
                alignment: Alignment.topCenter,
                child: Column(
                  children: locations.asMap().entries.map(
                        (entry) => PracticeLocationTile(
                          location: entry.value,
                          onRemove: () => onRemoveLocation(entry.key),
                        ),
                      ).toList(),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

InputDecoration _compactLocationFieldDecoration(
  BuildContext context, {
  required String label,
  required String hint,
}) {
  final labelStyle = Theme.of(context).textTheme.labelSmall;
  return InputDecoration(
    labelText: label,
    hintText: hint,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(
      horizontal: ViroSpacing.sm,
      vertical: ViroSpacing.xs,
    ),
    labelStyle: labelStyle,
    hintStyle: labelStyle?.copyWith(
      color: ViroColors.gray400,
      fontStyle: FontStyle.italic,
    ),
  );
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
    final accent = ViroColors.sportGreen;

    return ViroPressable(
      onTap: () => onChanged(!selected),
      borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
      child: AnimatedContainer(
        duration: ViroMotion.standard,
        curve: ViroMotion.enter,
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.sm,
          vertical: ViroSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: selected ? accent.withValues(alpha: 0.1) : ViroColors.surfaceCard,
          borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
          border: Border.all(
            color: selected ? accent : ViroColors.primary100,
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AnimatedContainer(
              duration: ViroMotion.fast,
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                color: selected ? accent : Colors.transparent,
                borderRadius: BorderRadius.circular(5),
                border: Border.all(
                  color: selected ? accent : ViroColors.gray300,
                  width: 1.5,
                ),
              ),
              alignment: Alignment.center,
              child: selected
                  ? ViroIcon(
                      ViroIcons.check,
                      color: ViroColors.white,
                      size: 12,
                    )
                  : null,
            ),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SetupJustifiedText(
                    hasStreetAddress
                        ? 'Utiliser l\'adresse du club comme lieu'
                        : 'Utiliser la ville du club comme lieu',
                    style: theme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: ViroColors.primary800,
                      height: 1.3,
                    ),
                  ),
                  SetupJustifiedText(
                    hasStreetAddress
                        ? 'Ajoute le siège comme premier lieu.'
                        : 'Ajoute la ville comme premier lieu.',
                    style: theme.labelSmall?.copyWith(
                      color: ViroColors.gray600,
                      height: 1.25,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddressAutocompleteField extends StatefulWidget {
  const _AddressAutocompleteField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.addressService,
    required this.onChanged,
    required this.onSuggestionSelected,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final FrenchAddressService addressService;
  final VoidCallback onChanged;
  final void Function(FrenchAddressSuggestion suggestion) onSuggestionSelected;

  @override
  State<_AddressAutocompleteField> createState() =>
      _AddressAutocompleteFieldState();
}

class _AddressAutocompleteFieldState extends State<_AddressAutocompleteField> {
  List<FrenchAddressSuggestion> _suggestions = [];
  Timer? _debounce;
  bool _loading = false;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onQueryChanged(String query) {
    widget.onChanged();
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      if (!mounted) return;
      setState(() => _loading = true);
      final results = await widget.addressService.search(query);
      if (mounted) {
        setState(() {
          _suggestions = results;
          _loading = false;
        });
      }
    });
  }

  void _select(FrenchAddressSuggestion suggestion) {
    setState(() => _suggestions = []);
    widget.onSuggestionSelected(suggestion);
    FocusManager.instance.primaryFocus?.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextFormField(
          controller: widget.controller,
          decoration: InputDecoration(
            labelText: widget.label,
            hintText: widget.hint,
            isDense: true,
            suffixIcon: _loading
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : null,
          ),
          onChanged: _onQueryChanged,
        ),
        if (_suggestions.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              color: ViroColors.surfaceCard,
              borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
              border: Border.all(color: ViroColors.primary100),
              boxShadow: ViroMotion.cardShadow(elevated: false),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _suggestions.length,
              separatorBuilder: (_, __) => Divider(
                height: 1,
                color: ViroColors.primary50,
              ),
              itemBuilder: (context, index) {
                final suggestion = _suggestions[index];
                return ListTile(
                  dense: true,
                  leading: ViroIcon(
                    ViroIcons.place,
                    size: 18,
                    color: ViroColors.primary600,
                  ),
                  title: Text(
                    suggestion.label,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  onTap: () => _select(suggestion),
                );
              },
            ),
          ),
      ],
    );
  }
}
