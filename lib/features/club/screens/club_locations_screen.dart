import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club_setup/practice_location_categories.dart';
import 'package:viro_team_v2/features/club_setup/services/french_address_service.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_format.dart';
import 'package:viro_team_v2/features/club_setup/widgets/french_address_fields.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/person_data_format.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Gestion admin des lieux de pratique du club (ajout / suppression).
class ClubLocationsScreen extends ConsumerStatefulWidget {
  const ClubLocationsScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<ClubLocationsScreen> createState() =>
      _ClubLocationsScreenState();
}

class _ClubLocationsScreenState extends ConsumerState<ClubLocationsScreen> {
  final _cityController = TextEditingController();
  final _postalController = TextEditingController();
  final _addressController = TextEditingController();
  final _customCategoryController = TextEditingController();
  final _addressService = FrenchAddressService();

  late String _category;
  bool _categoryReady = false;
  bool _busy = false;

  @override
  void dispose() {
    _cityController.dispose();
    _postalController.dispose();
    _addressController.dispose();
    _customCategoryController.dispose();
    _addressService.dispose();
    super.dispose();
  }

  void _ensureCategory(String sport) {
    if (_categoryReady) return;
    _category = PracticeLocationCategories.defaultForSport(sport);
    _categoryReady = true;
  }

  /// Indique si le formulaire d’ajout est complet et valide.
  bool get _canAdd {
    final city = _cityController.text.trim();
    final postal = _postalController.text.trim();
    final address = _addressController.text.trim();
    if (city.isEmpty || postal.isEmpty || address.isEmpty) return false;
    if (cityError(city) != null) return false;
    if (postalCodeError(postal) != null) return false;
    if (addressLineError(address) != null) return false;
    if (_category == PracticeLocationCategories.other &&
        _customCategoryController.text.trim().isEmpty) {
      return false;
    }
    return true;
  }

  Future<void> _persist(
    List<PracticeLocation> locations, {
    required String successMessage,
  }) async {
    setState(() => _busy = true);
    try {
      await ref.read(clubServiceProvider).updatePracticeLocations(
            clubId: widget.clubId,
            locations: locations,
          );
      invalidateClubVisualCaches(ref, widget.clubId);
      if (mounted) {
        ViroSnackBar.show(context, successMessage);
      }
    } catch (e) {
      if (mounted) {
        ViroSnackBar.show(context, 'Erreur : $e');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addLocation(Club club) async {
    if (!_canAdd || _busy) return;

    final formattedCity = formatCity(_cityController.text);
    final formattedAddress = formatAddressLine(_addressController.text);
    final custom = _customCategoryController.text.trim();
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

    final next = [...club.practiceLocations, location];
    await _persist(next, successMessage: 'Lieu ajouté');
    if (!mounted) return;
    _cityController.clear();
    _postalController.clear();
    _addressController.clear();
    _customCategoryController.clear();
    setState(() {});
  }

  Future<void> _removeLocation(Club club, int index) async {
    if (_busy || index < 0 || index >= club.practiceLocations.length) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Supprimer ce lieu ?'),
        content: Text(club.practiceLocations[index].name),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final next = List<PracticeLocation>.from(club.practiceLocations)
      ..removeAt(index);
    await _persist(next, successMessage: 'Lieu supprimé');
  }

  String _locationSubtitle(PracticeLocation location) {
    final parts = <String>[
      if (location.address != null && location.address!.trim().isNotEmpty)
        location.address!.trim(),
      if (location.city != null && location.city!.trim().isNotEmpty)
        location.city!.trim(),
    ];
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final clubAsync = ref.watch(clubProvider(clubId));
    final member = ref.watch(clubMemberProvider(clubId)).value;
    final accent = ref.watch(clubManagementAccentProvider(clubId));

    if (member != null && member.role != MemberRoles.admin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.pop();
      });
      return const ViroScaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return ClubAccentTheme(
      accentColor: accent,
      child: ViroScaffold(
        appBar: ViroAppBar(
          leading: IconButton(
            icon: ViroIcon(ViroIcons.chevronLeft),
            onPressed: () => context.pop(),
          ),
          title: const Text('Lieux du club'),
        ),
        body: clubAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => const ViroErrorState(),
          data: (club) {
            if (club == null) {
              return const Center(child: Text('Club introuvable'));
            }
            _ensureCategory(club.sport);
            final categories =
                PracticeLocationCategories.forSport(club.sport);
            final locations = club.practiceLocations;

            return ListView(
              padding: const EdgeInsets.all(ViroSpacing.screenHorizontal),
              children: [
                Text(
                  'Lieux enregistrés',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: accent,
                      ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  'Utilisés pour le planning, les matchs et le lieu de RDV.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
                      ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                if (locations.isEmpty)
                  ViroCard(
                    margin: EdgeInsets.zero,
                    padding: const EdgeInsets.all(ViroSpacing.md),
                    child: Text(
                      'Aucun lieu pour l’instant. Ajoutez le premier ci-dessous.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  )
                else
                  ...[
                    for (var i = 0; i < locations.length; i++) ...[
                      if (i > 0) const SizedBox(height: ViroSpacing.sm),
                      ViroCard(
                        margin: EdgeInsets.zero,
                        padding: const EdgeInsets.symmetric(
                          horizontal: ViroSpacing.sm,
                          vertical: ViroSpacing.xs,
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: ViroSpacing.sm,
                          ),
                          leading: ViroIcon(ViroIcons.place, color: accent),
                          title: Text(
                            locations[i].name,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: _locationSubtitle(locations[i]).isEmpty
                              ? null
                              : Text(_locationSubtitle(locations[i])),
                          trailing: IconButton(
                            icon: ViroIcon(
                              ViroIcons.trash,
                              color: ViroColors.error,
                            ),
                            onPressed: _busy
                                ? null
                                : () => _removeLocation(club, i),
                          ),
                        ),
                      ),
                    ],
                  ],
                const SizedBox(height: ViroSpacing.xl),
                Text(
                  'Ajouter un lieu',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: accent,
                      ),
                ),
                const SizedBox(height: ViroSpacing.sm),
                ViroCard(
                  margin: EdgeInsets.zero,
                  padding: const EdgeInsets.all(ViroSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Type de lieu',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
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
                          separatorBuilder: (_, __) =>
                              const SizedBox(width: ViroSpacing.xs),
                          itemBuilder: (context, index) {
                            final category = categories[index];
                            final selected = _category == category;
                            return ViroPressable(
                              enabled: !_busy,
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
                                    color: selected
                                        ? accent
                                        : ViroColors.primary100,
                                  ),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  PracticeLocationCategories.label(category),
                                  style: Theme.of(context)
                                      .textTheme
                                      .labelMedium
                                      ?.copyWith(
                                        fontWeight: FontWeight.w600,
                                        color: selected
                                            ? accent
                                            : ViroColors.primary800,
                                      ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      if (_category == PracticeLocationCategories.other) ...[
                        const SizedBox(height: ViroSpacing.sm),
                        TextField(
                          controller: _customCategoryController,
                          enabled: !_busy,
                          decoration: const InputDecoration(
                            labelText: 'Préciser',
                            hintText: 'Terrain synthétique…',
                            isDense: true,
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                      ],
                      const SizedBox(height: ViroSpacing.md),
                      FrenchAddressFields(
                        cityController: _cityController,
                        postalController: _postalController,
                        addressController: _addressController,
                        addressService: _addressService,
                        accent: accent,
                        enabled: !_busy,
                        addressLabel: 'Adresse',
                        addressHint: 'Rue, numéro ou lieu…',
                        onFieldChanged: () => setState(() {}),
                      ),
                      const SizedBox(height: ViroSpacing.md),
                      ViroPrimaryButton(
                        label: 'Ajouter le lieu',
                        isLoading: _busy,
                        onPressed:
                            _busy || !_canAdd ? null : () => _addLocation(club),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ViroSpacing.xl),
              ],
            );
          },
        ),
      ),
    );
  }
}
