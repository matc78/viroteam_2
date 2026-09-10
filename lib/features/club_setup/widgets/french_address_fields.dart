import 'dart:async';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club_setup/services/french_address_service.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Ville + code postal + adresse avec suggestions (BAN / Google Places).
///
/// Réutilisé par le wizard siège et le formulaire match extérieur.
class FrenchAddressFields extends StatefulWidget {
  const FrenchAddressFields({
    super.key,
    required this.cityController,
    required this.postalController,
    required this.addressController,
    required this.addressService,
    required this.accent,
    this.onFieldChanged,
    this.addressLabel,
    this.addressHint,
    this.enabled = true,
  });

  final TextEditingController cityController;
  final TextEditingController postalController;
  final TextEditingController addressController;
  final FrenchAddressService addressService;
  final Color accent;
  final VoidCallback? onFieldChanged;
  final String? addressLabel;
  final String? addressHint;
  final bool enabled;

  @override
  State<FrenchAddressFields> createState() => _FrenchAddressFieldsState();
}

class _FrenchAddressFieldsState extends State<FrenchAddressFields> {
  static const _maxSuggestions = 3;

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

  void _notifyChanged() => widget.onFieldChanged?.call();

  void _onCityQueryChanged(String query) {
    _notifyChanged();
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
        _citySuggestions = results.take(_maxSuggestions).toList();
        _streetSuggestions = [];
        _cityLoading = false;
      });
    });
  }

  void _onStreetQueryChanged(String query) {
    _notifyChanged();
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
        _streetSuggestions = results.take(_maxSuggestions).toList();
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
    _notifyChanged();
    FocusManager.instance.primaryFocus?.unfocus();
  }

  void _selectStreet(FrenchAddressSuggestion suggestion) {
    widget.addressController.text = suggestion.street;
    if (suggestion.postalCode.isNotEmpty) {
      widget.postalController.text = suggestion.postalCode;
    }
    setState(() => _streetSuggestions = []);
    _notifyChanged();
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
                label: AppCopy.clubSetup.cityLabel,
                hint: AppCopy.clubSetup.cityHint,
                accent: widget.accent,
                prefixIcon: ViroIcons.place,
                loading: _cityLoading,
                enabled: widget.enabled,
                onChanged: _onCityQueryChanged,
              ),
            ),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(
              flex: 2,
              child: TextFormField(
                controller: widget.postalController,
                enabled: widget.enabled,
                decoration: _tintedFieldDecoration(
                  context,
                  label: AppCopy.clubSetup.postalCodeLabel,
                  hint: AppCopy.clubSetup.postalCodeHint,
                  accent: widget.accent,
                ),
                keyboardType: TextInputType.number,
                onChanged: (_) => _notifyChanged(),
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
          label: widget.addressLabel ?? AppCopy.clubSetup.addressLabel,
          hint: widget.addressHint ?? AppCopy.clubSetup.addressHint,
          accent: widget.accent,
          prefixIcon: ViroIcons.place,
          loading: _streetLoading,
          enabled: widget.enabled,
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

InputDecoration _tintedFieldDecoration(
  BuildContext context, {
  required String label,
  required String hint,
  required Color accent,
  IconData? prefixIcon,
}) {
  return InputDecoration(
    labelText: label,
    hintText: hint,
    isDense: true,
    filled: true,
    fillColor: accent.withValues(alpha: 0.08),
    prefixIcon: prefixIcon == null
        ? null
        : Padding(
            padding: const EdgeInsets.only(
              left: ViroSpacing.sm,
              right: ViroSpacing.xs,
            ),
            child: ViroIcon(prefixIcon, size: 18, color: accent),
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
    this.enabled = true,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final Color accent;
  final bool loading;
  final ValueChanged<String> onChanged;
  final IconData? prefixIcon;
  final VoidCallback? onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      enabled: enabled,
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
    final radius = BorderRadius.circular(ViroSpacing.cardRadius);
    // Bordure / ombre sur le Container ; fond sur Material pour ink ListTile.
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: ViroSpacing.xs),
      decoration: BoxDecoration(
        borderRadius: radius,
        border: Border.all(color: accent.withValues(alpha: 0.45)),
        boxShadow: ViroMotion.cardShadow(elevated: false),
      ),
      child: Material(
        color: ViroColors.surfaceCard,
        borderRadius: radius,
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var index = 0; index < suggestions.length; index++) ...[
              if (index > 0)
                Divider(height: 1, color: accent.withValues(alpha: 0.12)),
              ListTile(
                dense: true,
                visualDensity: VisualDensity.compact,
                leading: ViroIcon(
                  ViroIcons.place,
                  size: 18,
                  color: accent,
                ),
                title: Text(
                  suggestions[index].label,
                  style: Theme.of(context).textTheme.bodySmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                onTap: () => onSelected(suggestions[index]),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
