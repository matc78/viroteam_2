import 'package:flutter/material.dart';
import 'package:viro_team_v2/features/club_setup/services/french_address_service.dart';
import 'package:viro_team_v2/features/club_setup/club_setup_steps.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_ui.dart';
import 'package:viro_team_v2/features/club_setup/widgets/french_address_fields.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_step_shell.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Étape siège — ville et adresse du club.
class HeadquartersStep extends StatelessWidget {
  const HeadquartersStep({
    super.key,
    required this.cityController,
    required this.postalController,
    required this.addressController,
    required this.addressService,
    required this.onFieldChanged,
  });

  final TextEditingController cityController;
  final TextEditingController postalController;
  final TextEditingController addressController;
  final FrenchAddressService addressService;
  final VoidCallback onFieldChanged;

  @override
  Widget build(BuildContext context) {
    final accent = ClubSetupUi.stepAccent(ClubSetupSteps.headquarters);

    return SetupStepShell(
      centerBody: true,
      subtitle: AppCopy.clubSetup.headquartersSubtitle,
      child: FrenchAddressFields(
        cityController: cityController,
        postalController: postalController,
        addressController: addressController,
        addressService: addressService,
        accent: accent,
        onFieldChanged: onFieldChanged,
        addressLabel: AppCopy.clubSetup.clubAddressLabel,
      ),
    );
  }
}
