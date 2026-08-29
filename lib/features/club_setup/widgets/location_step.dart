import 'dart:async';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club_setup/services/french_address_service.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_ui.dart';
import 'package:viro_team_v2/features/club_setup/widgets/practice_location_tile.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_step_shell.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

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

    const headquartersAccent = ViroColors.sportCyan;
    const practiceAccent = ViroColors.sportOrange;

    return SetupStepShell(
      centerBody: true,
      subtitle: 'Siège du club et lieux de pratique.',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _LocationSectionCard(
            title: 'Siège du club',
            icon: ViroIcons.place,
            accent: headquartersAccent,
            child: _HeadquartersAddressBlock(
              cityController: cityController,
              postalController: postalController,
              addressController: addressController,
              addressService: addressService,
              accent: headquartersAccent,
              onFieldChanged: onFieldChanged,
            ),
          ),
          const SizedBox(height: ViroSpacing.sm),
          _UseClubAddressOption(
            selected: useClubAddressAsFirstLocation,
            hasStreetAddress: hasStreetAddress,
            onChanged: onUseClubAddressChanged,
          ),
          const SizedBox(height: ViroSpacing.sm),
          _LocationSectionCard(
            title: 'Lieux de pratique',
            icon: ViroIcons.ball,
            accent: practiceAccent,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: locationNameController,
                  style: Theme.of(context).textTheme.labelSmall,
                  decoration: _tintedFieldDecoration(
                    context,
                    label: 'Nom du lieu',
                    hint: 'Ex. Stade municipal',
                    accent: practiceAccent,
                    prefixIcon: ViroIcons.ball,
                    compact: true,
                  ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                TextFormField(
                  controller: locationAddressController,
                  style: Theme.of(context).textTheme.labelSmall,
                  decoration: _tintedFieldDecoration(
                    context,
                    label: 'Adresse du lieu (optionnel)',
                    hint: 'Si différente du siège',
                    accent: practiceAccent,
                    prefixIcon: ViroIcons.place,
                    compact: true,
                  ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                Align(
                  alignment: Alignment.centerLeft,
                  child: ElevatedButton.icon(
                    onPressed: onAddLocation,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: practiceAccent,
                      foregroundColor: ViroColors.white,
                      minimumSize: const Size(0, ViroSpacing.xl),
                      padding: const EdgeInsets.symmetric(
                        horizontal: ViroSpacing.sm,
                        vertical: ViroSpacing.xs,
                      ),
                      textStyle:
                          Theme.of(context).textTheme.labelSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                    ),
                    icon: ViroIcon(
                      ViroIcons.add,
                      size: 14,
                      color: ViroColors.white,
                    ),
                    label: const Text('Ajouter ce lieu'),
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
                              accent: ClubSetupUi.sportAccents[
                                  entry.key % ClubSetupUi.sportAccents.length],
                              onRemove: () => onRemoveLocation(entry.key),
                            ),
                          ).toList(),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

InputDecoration _tintedFieldDecoration(
  BuildContext context, {
  required String label,
  required String hint,
  required Color accent,
  IconData? prefixIcon,
  bool compact = false,
}) {
  final labelStyle = compact ? Theme.of(context).textTheme.labelSmall : null;
  return InputDecoration(
    labelText: label,
    hintText: hint,
    isDense: true,
    filled: true,
    fillColor: accent.withValues(alpha: 0.08),
    contentPadding: compact
        ? const EdgeInsets.symmetric(
            horizontal: ViroSpacing.sm,
            vertical: ViroSpacing.xs,
          )
        : null,
    labelStyle: labelStyle,
    hintStyle: (labelStyle ?? Theme.of(context).textTheme.bodyMedium)?.copyWith(
      color: ViroColors.gray400,
      fontStyle: FontStyle.italic,
    ),
    prefixIcon: prefixIcon == null
        ? null
        : Padding(
            padding: const EdgeInsets.only(
              left: ViroSpacing.sm,
              right: ViroSpacing.xs,
            ),
            child: ViroIcon(
              prefixIcon,
              size: compact ? 16 : 18,
              color: accent,
            ),
          ),
    prefixIconConstraints: const BoxConstraints(minWidth: 32, minHeight: 32),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
      borderSide: BorderSide(color: accent.withValues(alpha: 0.4)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
      borderSide: BorderSide(color: accent, width: 2),
    ),
  );
}

class _LocationSectionCard extends StatelessWidget {
  const _LocationSectionCard({
    required this.title,
    required this.icon,
    required this.accent,
    required this.child,
  });

  final String title;
  final IconData icon;
  final Color accent;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ViroCard(
      accentColor: accent,
      elevated: true,
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.md,
        ViroSpacing.sm,
        ViroSpacing.md,
        ViroSpacing.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: ViroIcon(icon, color: accent, size: 18),
              ),
              const SizedBox(width: ViroSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: ViroColors.primary800,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: ViroSpacing.sm),
          child,
        ],
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
    const accent = ViroColors.sportGreen;

    return ViroCard(
      onTap: () => onChanged(!selected),
      elevated: true,
      margin: EdgeInsets.zero,
      padding: EdgeInsets.zero,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.md,
                  ViroSpacing.md,
                  ViroSpacing.sm,
                  ViroSpacing.md,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hasStreetAddress
                          ? 'Utiliser l\'adresse du club comme lieu'
                          : 'Utiliser la ville du club comme lieu',
                      style: theme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: ViroColors.primary800,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: ViroSpacing.xs),
                    Text(
                      hasStreetAddress
                          ? 'Ajoute le siège comme premier lieu.'
                          : 'Ajoute la ville comme premier lieu.',
                      style: theme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            AspectRatio(
              aspectRatio: 1,
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
                        size: 28,
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

class _HeadquartersAddressBlock extends StatefulWidget {
  const _HeadquartersAddressBlock({
    required this.cityController,
    required this.postalController,
    required this.addressController,
    required this.addressService,
    required this.accent,
    required this.onFieldChanged,
  });

  final TextEditingController cityController;
  final TextEditingController postalController;
  final TextEditingController addressController;
  final FrenchAddressService addressService;
  final Color accent;
  final VoidCallback onFieldChanged;

  @override
  State<_HeadquartersAddressBlock> createState() =>
      _HeadquartersAddressBlockState();
}

class _HeadquartersAddressBlockState extends State<_HeadquartersAddressBlock> {
  List<FrenchAddressSuggestion> _citySuggestions = [];
  List<FrenchAddressSuggestion> _streetSuggestions = [];
  Timer? _cityDebounce;
  Timer? _streetDebounce;
  bool _cityLoading = false;
  bool _streetLoading = false;
  int _citySearchId = 0;
  int _streetSearchId = 0;

  @override
  void dispose() {
    _cityDebounce?.cancel();
    _streetDebounce?.cancel();
    super.dispose();
  }

  void _onCityQueryChanged(String query) {
    widget.onFieldChanged();
    _cityDebounce?.cancel();
    final searchId = ++_citySearchId;
    _streetDebounce?.cancel();
    _streetSearchId++;
    if (_streetLoading || _streetSuggestions.isNotEmpty) {
      setState(() {
        _streetLoading = false;
        _streetSuggestions = [];
      });
    }
    _cityDebounce = Timer(ViroMotion.modal, () async {
      if (!mounted || searchId != _citySearchId) return;
      setState(() => _cityLoading = true);
      final results = await widget.addressService.searchCities(query);
      if (!mounted || searchId != _citySearchId) return;
      setState(() {
        _citySuggestions = results;
        _streetSuggestions = [];
        _cityLoading = false;
      });
    });
  }

  void _onStreetQueryChanged(String query) {
    widget.onFieldChanged();
    _streetDebounce?.cancel();
    final searchId = ++_streetSearchId;
    _cityDebounce?.cancel();
    _citySearchId++;
    if (_cityLoading || _citySuggestions.isNotEmpty) {
      setState(() {
        _cityLoading = false;
        _citySuggestions = [];
      });
    }
    _streetDebounce = Timer(ViroMotion.modal, () async {
      if (!mounted || searchId != _streetSearchId) return;
      setState(() => _streetLoading = true);
      final results = await widget.addressService.searchStreets(
        query,
        city: widget.cityController.text,
        postalCode: widget.postalController.text,
      );
      if (!mounted || searchId != _streetSearchId) return;
      setState(() {
        _streetSuggestions = results;
        _citySuggestions = [];
        _streetLoading = false;
      });
    });
  }

  void _selectCity(FrenchAddressSuggestion suggestion) {
    widget.cityController.text = suggestion.city;
    widget.postalController.text = suggestion.postalCode;
    _streetSearchId++;
    setState(() {
      _citySuggestions = [];
      _streetSuggestions = [];
    });
    widget.onFieldChanged();
    FocusManager.instance.primaryFocus?.unfocus();
  }

  void _selectStreet(FrenchAddressSuggestion suggestion) {
    widget.addressController.text = suggestion.street;
    if (suggestion.postalCode.isNotEmpty) {
      widget.postalController.text = suggestion.postalCode;
    }
    setState(() => _streetSuggestions = []);
    widget.onFieldChanged();
    FocusManager.instance.primaryFocus?.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 3,
              child: _AddressQueryField(
                controller: widget.cityController,
                label: 'Ville',
                hint: 'Ex. Viroflay',
                accent: widget.accent,
                prefixIcon: ViroIcons.place,
                loading: _cityLoading,
                onChanged: _onCityQueryChanged,
              ),
            ),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(
              flex: 2,
              child: TextFormField(
                controller: widget.postalController,
                decoration: _tintedFieldDecoration(
                  context,
                  label: 'Code postal',
                  hint: '78220',
                  accent: widget.accent,
                ),
                keyboardType: TextInputType.number,
                onChanged: (_) => widget.onFieldChanged(),
              ),
            ),
          ],
        ),
        if (_citySuggestions.isNotEmpty)
          _AddressSuggestionPanel(
            suggestions: _citySuggestions,
            accent: widget.accent,
            onSelected: _selectCity,
          ),
        const SizedBox(height: ViroSpacing.sm),
        _AddressQueryField(
          controller: widget.addressController,
          label: 'Adresse du club',
          hint: 'Gymnase, stade ou rue…',
          accent: widget.accent,
          prefixIcon: ViroIcons.place,
          loading: _streetLoading,
          onChanged: _onStreetQueryChanged,
          onTap: () => _onStreetQueryChanged(widget.addressController.text),
        ),
        if (_streetSuggestions.isNotEmpty)
          _AddressSuggestionPanel(
            suggestions: _streetSuggestions,
            accent: widget.accent,
            onSelected: _selectStreet,
          ),
      ],
    );
  }
}

class _AddressQueryField extends StatelessWidget {
  const _AddressQueryField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.accent,
    required this.loading,
    required this.onChanged,
    this.prefixIcon,
    this.onTap,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final Color accent;
  final bool loading;
  final ValueChanged<String> onChanged;
  final IconData? prefixIcon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      decoration: _tintedFieldDecoration(
        context,
        label: label,
        hint: hint,
        accent: accent,
        prefixIcon: prefixIcon,
      ).copyWith(
        suffixIcon: loading
            ? const Padding(
                padding: EdgeInsets.all(ViroSpacing.sm),
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            : null,
      ),
      onChanged: onChanged,
      onTap: onTap,
    );
  }
}

class _AddressSuggestionPanel extends StatelessWidget {
  const _AddressSuggestionPanel({
    required this.suggestions,
    required this.accent,
    required this.onSelected,
  });

  final List<FrenchAddressSuggestion> suggestions;
  final Color accent;
  final void Function(FrenchAddressSuggestion suggestion) onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: ViroSpacing.xs),
      decoration: BoxDecoration(
        color: ViroColors.surfaceCard,
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        border: Border.all(color: accent.withValues(alpha: 0.45)),
        boxShadow: ViroMotion.cardShadow(elevated: false),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: suggestions.length,
        separatorBuilder: (_, _) => Divider(
          height: 1,
          color: accent.withValues(alpha: 0.12),
        ),
        itemBuilder: (context, index) {
          final suggestion = suggestions[index];
          return ListTile(
            dense: true,
            leading: ViroIcon(
              suggestion.isSportsVenue ? ViroIcons.ball : ViroIcons.place,
              size: 18,
              color: accent,
            ),
            title: Text(
              suggestion.label,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            onTap: () => onSelected(suggestion),
          );
        },
      ),
    );
  }
}
