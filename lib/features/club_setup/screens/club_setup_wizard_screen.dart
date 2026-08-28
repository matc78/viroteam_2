import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club_setup/club_setup_steps.dart';
import 'package:viro_team_v2/features/club_setup/models/club_setup_draft.dart';
import 'package:viro_team_v2/features/club_setup/providers/club_setup_provider.dart';
import 'package:viro_team_v2/features/club_setup/widgets/identity_step.dart';
import 'package:viro_team_v2/features/club_setup/widgets/location_step.dart';
import 'package:viro_team_v2/features/club_setup/widgets/objectives_step.dart';
import 'package:viro_team_v2/features/club_setup/widgets/prerequisites_step.dart';
import 'package:viro_team_v2/features/club_setup/widgets/recap_step.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_progress_header.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_format.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_portal_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Écran wizard de création de club (5 étapes).
class ClubSetupWizardScreen extends ConsumerStatefulWidget {
  const ClubSetupWizardScreen({super.key});

  @override
  ConsumerState<ClubSetupWizardScreen> createState() =>
      _ClubSetupWizardScreenState();
}

class _ClubSetupWizardScreenState extends ConsumerState<ClubSetupWizardScreen>
    with WidgetsBindingObserver {
  PageController? _pageController;
  int _step = 0;
  bool _submitting = false;
  bool _isInitialized = false;
  bool _hadPersistedDraft = false;
  bool _useClubAddressAsFirstLocation = false;

  final _nameController = TextEditingController();
  final _cityController = TextEditingController();
  final _postalController = TextEditingController();
  final _addressController = TextEditingController();
  final _locationNameController = TextEditingController();
  final _locationAddressController = TextEditingController();
  final _descriptionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initWizard();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pageController?.dispose();
    _nameController.dispose();
    _cityController.dispose();
    _postalController.dispose();
    _addressController.dispose();
    _locationNameController.dispose();
    _locationAddressController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      ref.read(clubSetupProvider.notifier).persistImmediately();
    }
  }

  Future<void> _initWizard() async {
    final authUser = ref.read(authStateProvider).value;
    if (authUser != null) {
      final notifier = ref.read(clubSetupProvider.notifier);
      notifier.setUserId(authUser.uid);
      _hadPersistedDraft = await notifier.restoreForUser(authUser.uid);

      final draft = ref.read(clubSetupProvider);
      _hydrateControllers(draft);
      _step = draft.currentStep;
    }

    _pageController = PageController(initialPage: _step);

    if (mounted) {
      setState(() => _isInitialized = true);
      if (_hadPersistedDraft && _step > ClubSetupSteps.prerequisites) {
        ViroSnackBar.show(context, 'Reprise de votre création en cours');
      }
    }
  }

  void _hydrateControllers(ClubSetupDraft draft) {
    _nameController.text = draft.name;
    _cityController.text = draft.city;
    _postalController.text = draft.postalCode;
    _addressController.text = draft.address;
    _descriptionController.text = draft.description;
  }

  void _dismissKeyboard() {
    FocusManager.instance.primaryFocus?.unfocus();
  }

  void _syncDraftFromControllers() {
    ref.read(clubSetupProvider.notifier).updateDraft((draft) {
      draft.name = _nameController.text.trim();
      draft.description = _descriptionController.text.trim();
      draft.city = _cityController.text.trim();
      draft.postalCode = _postalController.text.trim();
      draft.address = _addressController.text.trim();
      return draft;
    });
  }

  Future<ViroUser?> _resolveCurrentUser() async {
    final cached = ref.read(viroUserProvider).value;
    if (cached != null) return cached;

    final authUser = ref.read(authStateProvider).value;
    if (authUser == null) return null;

    return ref.read(userServiceProvider).getUser(authUser.uid);
  }

  String _continueLabel() {
    if (_step == ClubSetupSteps.prerequisites) return 'C\'est parti';
    return 'Continuer';
  }

  void _next() {
    _dismissKeyboard();
    if (_step == ClubSetupSteps.identity ||
        _step == ClubSetupSteps.location) {
      _syncDraftFromControllers();
    }

    final draft = ref.read(clubSetupProvider);
    if (_step == ClubSetupSteps.identity && !draft.canProceedIdentity) {
      _showError('Nom du club (2 caractères min.) et sport requis.');
      return;
    }
    if (_step == ClubSetupSteps.objectives && !draft.canProceedObjectives) {
      _showError('Sélectionnez au moins un objectif.');
      return;
    }
    if (_step == ClubSetupSteps.location && !draft.canProceedInfo) {
      _showError('Ville et au moins un lieu de pratique requis.');
      return;
    }

    if (_step < ClubSetupSteps.total - 1) {
      final nextStep = _step + 1;
      _pageController!.nextPage(
        duration: ViroMotion.modal,
        curve: ViroMotion.enter,
      );
      setState(() => _step = nextStep);
      ref.read(clubSetupProvider.notifier).setCurrentStep(nextStep);
    }
  }

  void _back() {
    _dismissKeyboard();
    if (_step == ClubSetupSteps.prerequisites) {
      ref.read(clubSetupProvider.notifier).persistImmediately();
      context.pop();
      return;
    }
    final previousStep = _step - 1;
    _pageController!.previousPage(
      duration: ViroMotion.modal,
      curve: ViroMotion.enter,
    );
    setState(() => _step = previousStep);
    ref.read(clubSetupProvider.notifier).setCurrentStep(previousStep);
  }

  void _showError(String message) {
    ViroSnackBar.show(context, message);
  }

  Future<void> _pickLogo() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 85,
    );
    if (file == null) return;
    final bytes = await file.readAsBytes();
    await ref.read(clubSetupProvider.notifier).setLogoBytes(bytes);
  }

  /// Ajoute le siège du club comme lieu de pratique si les champs le permettent.
  bool _addClubHeadquartersAsLocation({required bool showErrorIfEmpty}) {
    _syncDraftFromControllers();
    final draft = ref.read(clubSetupProvider);
    final city = draft.city.trim();

    if (city.isEmpty && draft.address.trim().isEmpty) {
      if (showErrorIfEmpty) {
        _showError('Renseignez d\'abord la ville du club.');
      }
      return false;
    }

    final locationName = ClubSetupFormat.headquartersPracticeName(city);
    final practiceAddress = ClubSetupFormat.headquartersPracticeAddress(
      address: draft.address,
      postalCode: draft.postalCode,
      city: draft.city,
    );

    ref.read(clubSetupProvider.notifier).updateDraft((draft) {
      final headquartersAlreadyAdded = draft.practiceLocations.any(
        (location) => location.name == locationName,
      );
      if (!headquartersAlreadyAdded) {
        draft.practiceLocations = [
          ...draft.practiceLocations,
          PracticeLocation(
            name: locationName,
            address: practiceAddress.isEmpty ? null : practiceAddress,
          ),
        ];
      }
      return draft;
    });
    return true;
  }

  void _onUseClubAddressChanged(bool useClubAddress) {
    setState(() => _useClubAddressAsFirstLocation = useClubAddress);
    if (useClubAddress) {
      final added = _addClubHeadquartersAsLocation(showErrorIfEmpty: true);
      if (!added) {
        setState(() => _useClubAddressAsFirstLocation = false);
      }
    }
  }

  Future<void> _addLocation() async {
    if (_useClubAddressAsFirstLocation) {
      _addClubHeadquartersAsLocation(showErrorIfEmpty: true);
      setState(() => _useClubAddressAsFirstLocation = false);
      return;
    }

    final locationName = _locationNameController.text.trim();
    if (locationName.isEmpty) {
      _showError('Indiquez un nom pour le lieu de pratique.');
      return;
    }

    ref.read(clubSetupProvider.notifier).updateDraft((draft) {
      draft.practiceLocations = [
        ...draft.practiceLocations,
        PracticeLocation(
          name: locationName,
          address: _locationAddressController.text.trim().isEmpty
              ? null
              : _locationAddressController.text.trim(),
        ),
      ];
      return draft;
    });
    _locationNameController.clear();
    _locationAddressController.clear();
  }

  Future<void> _submit() async {
    _dismissKeyboard();
    _syncDraftFromControllers();
    final draft = ref.read(clubSetupProvider);

    if (!draft.canProceedIdentity) {
      _showError('Nom du club et sport requis.');
      return;
    }
    if (!draft.canProceedObjectives) {
      _showError('Sélectionnez au moins un objectif.');
      return;
    }
    if (!draft.canProceedInfo) {
      _showError('Ville et au moins un lieu de pratique requis.');
      return;
    }

    final user = await _resolveCurrentUser();
    if (user == null) {
      _showError(
        'Profil introuvable. Reconnectez-vous ou vérifiez votre connexion.',
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await ref.read(clubServiceProvider).createClubFromDraft(
            founderUid: user.uid,
            founder: user,
            draft: draft,
          );
      await ref.read(clubSetupProvider.notifier).resetAndClear(user.uid);
      ref.invalidate(viroUserProvider);
      ref.invalidate(viroUserFutureProvider);
      if (mounted) context.go(AppRoutes.home);
    } catch (error) {
      _showError('Erreur lors de la création : $error');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized || _pageController == null) {
      return const ViroScaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final draft = ref.watch(clubSetupProvider);
    final stepLabel = ClubSetupSteps.labels[_step];
    final showResumeBanner = _hadPersistedDraft &&
        draft.hasSavedProgress &&
        _step == ClubSetupSteps.prerequisites;

    return ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: _back,
        ),
        title: AnimatedSwitcher(
          duration: ViroMotion.standard,
          child: Text(
            stepLabel,
            key: ValueKey(stepLabel),
          ),
        ),
        bottom: SetupProgressHeader(
          currentStep: _step,
          totalSteps: ClubSetupSteps.total,
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                PrerequisitesStep(showResumeBanner: showResumeBanner),
                IdentityStep(
                  draft: draft,
                  nameController: _nameController,
                  descriptionController: _descriptionController,
                  onPickLogo: _pickLogo,
                  onNameChanged: (name) {
                    ref.read(clubSetupProvider.notifier).updateDraft((d) {
                      d.name = name;
                      return d;
                    });
                  },
                  onSportChanged: (sport) {
                    ref.read(clubSetupProvider.notifier).updateDraft((d) {
                      d.sport = sport;
                      return d;
                    });
                  },
                  onDescriptionChanged: () {
                    ref.read(clubSetupProvider.notifier).updateDraft((d) {
                      d.description = _descriptionController.text.trim();
                      return d;
                    });
                  },
                ),
                ObjectivesStep(
                  selected: draft.objectives,
                  memberCountRange: draft.memberCountRange,
                  onToggle: (key) {
                    ref.read(clubSetupProvider.notifier).toggleObjective(key);
                  },
                  onMemberCountChanged: (range) {
                    ref.read(clubSetupProvider.notifier).updateDraft((d) {
                      d.memberCountRange = range;
                      return d;
                    });
                  },
                ),
                LocationStep(
                  cityController: _cityController,
                  postalController: _postalController,
                  addressController: _addressController,
                  locationNameController: _locationNameController,
                  locationAddressController: _locationAddressController,
                  locations: draft.practiceLocations,
                  addressService: ref.read(frenchAddressServiceProvider),
                  useClubAddressAsFirstLocation: _useClubAddressAsFirstLocation,
                  onUseClubAddressChanged: _onUseClubAddressChanged,
                  onFieldChanged: () {
                    ref.read(clubSetupProvider.notifier).updateDraft((d) {
                      d.city = _cityController.text;
                      d.postalCode = _postalController.text;
                      d.address = _addressController.text;
                      return d;
                    });
                  },
                  onAddLocation: _addLocation,
                  onRemoveLocation: (index) {
                    ref.read(clubSetupProvider.notifier).updateDraft((d) {
                      d.practiceLocations = List.of(d.practiceLocations)
                        ..removeAt(index);
                      return d;
                    });
                  },
                ),
                RecapStep(draft: draft),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              ViroSpacing.lg,
              ViroSpacing.sm,
              ViroSpacing.lg,
              ViroSpacing.md,
            ),
            child: _step < ClubSetupSteps.total - 1
                ? ViroPortalButton(
                    label: _continueLabel(),
                    onPressed: _next,
                  )
                : ViroPortalButton(
                    label: 'Créer le club',
                    isLoading: _submitting,
                    onPressed: _submit,
                  ),
          ),
        ],
      ),
    );
  }
}
