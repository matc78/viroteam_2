import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club_setup/services/french_address_service.dart';
import 'package:viro_team_v2/features/club_setup/widgets/french_address_fields.dart';
import 'package:viro_team_v2/features/planning/utils/add_event_helpers.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_field_label.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';

/// Domicile/extérieur (match) + lieu (liste club, adresse FR ou saisie libre).
class AddEventLocationSection extends StatelessWidget {
  /// Section lieu de l’événement selon le type et le venue match.
  const AddEventLocationSection({
    super.key,
    required this.isMatch,
    required this.matchVenue,
    required this.useAwayLocationField,
    required this.practiceLocations,
    required this.selectedLocationIndex,
    required this.locationController,
    required this.awayCityController,
    required this.awayPostalController,
    required this.awayAddressController,
    required this.addressService,
    required this.accentColor,
    required this.onAccentColor,
    required this.enabled,
    required this.onMatchVenueChanged,
    required this.onLocationIndexChanged,
  });

  final bool isMatch;
  final String? matchVenue;
  final bool useAwayLocationField;
  final List<PracticeLocation> practiceLocations;
  final int? selectedLocationIndex;
  final TextEditingController locationController;
  final TextEditingController awayCityController;
  final TextEditingController awayPostalController;
  final TextEditingController awayAddressController;
  final FrenchAddressService addressService;
  final Color accentColor;
  final Color onAccentColor;
  final bool enabled;
  final ValueChanged<String?> onMatchVenueChanged;
  final ValueChanged<int?> onLocationIndexChanged;

  @override
  Widget build(BuildContext context) {
    final dropdownStyle = Theme.of(context).textTheme.bodyMedium;
    final selectedLocationValid = selectedLocationIndex != null &&
        selectedLocationIndex! >= 0 &&
        selectedLocationIndex! < practiceLocations.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (isMatch) ...[
          AddEventFieldLabel(
            AppCopy.planning.homeOrAway,
            accentColor: accentColor,
          ),
          SegmentedButton<String>(
            style: ClubAccentTheme.segmentedButtonStyle(
              accentColor,
              onAccentColor,
            ),
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
            selected: {matchVenue ?? MatchVenues.home},
            onSelectionChanged:
                enabled ? (s) => onMatchVenueChanged(s.first) : null,
          ),
          const SizedBox(height: ViroSpacing.md),
        ],
        if (useAwayLocationField) ...[
          AddEventFieldLabel(
            AppCopy.planning.matchVenue,
            accentColor: accentColor,
          ),
          FrenchAddressFields(
            cityController: awayCityController,
            postalController: awayPostalController,
            addressController: awayAddressController,
            addressService: addressService,
            accent: accentColor,
            enabled: enabled,
            addressLabel: AppCopy.planning.address,
            addressHint: AppCopy.planning.addressHint,
          ),
          const SizedBox(height: ViroSpacing.md),
        ] else if (practiceLocations.isNotEmpty) ...[
          DropdownButtonFormField<int>(
            key: ValueKey('loc_$selectedLocationIndex'),
            initialValue:
                selectedLocationValid ? selectedLocationIndex : null,
            isDense: true,
            isExpanded: true,
            style: dropdownStyle,
            menuMaxHeight: 240,
            decoration:
                addEventInputDecoration(label: AppCopy.planning.fieldLocation),
            selectedItemBuilder: (context) => [
              for (final location in practiceLocations)
                Text(
                  addEventPracticeLocationLabel(location),
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
            ],
            onChanged: enabled ? onLocationIndexChanged : null,
          ),
          const SizedBox(height: ViroSpacing.md),
        ] else ...[
          AddEventFieldLabel(
            AppCopy.planning.fieldLocation,
            accentColor: accentColor,
          ),
          TextField(
            controller: locationController,
            decoration:
                addEventInputDecoration(hint: AppCopy.planning.locationHint),
            enabled: enabled,
          ),
          const SizedBox(height: ViroSpacing.md),
        ],
      ],
    );
  }
}
