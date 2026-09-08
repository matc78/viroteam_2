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
import 'package:viro_team_v2/features/club_setup/utils/club_setup_format.dart';
import 'package:viro_team_v2/features/club_setup/widgets/headquarters_step.dart';
import 'package:viro_team_v2/features/club_setup/widgets/identity_step.dart';
import 'package:viro_team_v2/features/club_setup/widgets/member_count_step.dart';
import 'package:viro_team_v2/features/club_setup/widgets/objectives_step.dart';
import 'package:viro_team_v2/features/club_setup/widgets/practice_locations_step.dart';
import 'package:viro_team_v2/features/club_setup/widgets/prerequisites_step.dart';
import 'package:viro_team_v2/features/club_setup/widgets/recap_step.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_progress_header.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_portal_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Écran wizard de création de club (7 étapes, format téléphone).
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

  final _nameController = TextEditingController();
  final _cityController = TextEditingController();
  final _postalController = TextEditingController();
  final _addressController = TextEditingController();

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
      final analytics = ref.read(clubSetupAnalyticsProvider);
      analytics.trackStarted(resumed: _hadPersistedDraft, initialStep: _step);
      analytics.trackStepViewed(_step);
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
  }

  void _dismissKeyboard() {
    FocusManager.instance.primaryFocus?.unfocus();
  }

  void _syncDraftFromControllers() {
    ref.read(clubSetupProvider.notifier).updateDraft((draft) {
      draft.name = _nameController.text.trim();
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
        _step == ClubSetupSteps.headquarters) {
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
    if (_step == ClubSetupSteps.headquarters) {
      if (!draft.canProceedHeadquarters) {
        _showError('Ville du club requise.');
        return;
      }
      if (draft.useClubAddressAsFirstLocation) {
        final upserted =
            _upsertClubHeadquartersLocation(showErrorIfEmpty: true);
        if (!upserted) return;
      }
    }
    if (_step == ClubSetupSteps.practiceLocations &&
        !draft.canProceedPracticeLocations) {
      _showError('Ajoutez au moins un lieu de pratique.');
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
      ref.read(clubSetupAnalyticsProvider).trackStepViewed(nextStep);
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
    ref.read(clubSetupAnalyticsProvider).trackStepViewed(previousStep);
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

  /// Construit le lieu siège à partir du brouillon, ou `null` si trop incomplet.
  PracticeLocation? _buildHeadquartersLocation() {
    _syncDraftFromControllers();
    final draft = ref.read(clubSetupProvider);
    if (draft.city.trim().isEmpty && draft.address.trim().isEmpty) {
      return null;
    }
    return ClubSetupFormat.headquartersPracticeLocation(
      sport: draft.sport,
      address: draft.address,
      postalCode: draft.postalCode,
      city: draft.city,
    );
  }

  /// Insère ou remplace le lieu dérivé du siège.
  bool _upsertClubHeadquartersLocation({required bool showErrorIfEmpty}) {
    final clubAddressLocation = _buildHeadquartersLocation();
    if (clubAddressLocation == null) {
      if (showErrorIfEmpty) {
        _showError('Renseignez d\'abord la ville du club.');
      }
      return false;
    }

    ref.read(clubSetupProvider.notifier).updateDraft((draft) {
      final locations = List<PracticeLocation>.of(draft.practiceLocations)
        ..removeWhere((location) => location.linkedToHeadquarters);
      final alreadyPresent = locations.any(
        (location) =>
            ClubSetupFormat.isSameLocation(location, clubAddressLocation),
      );
      draft.practiceLocations = alreadyPresent
          ? locations
          : [clubAddressLocation, ...locations];
      draft.useClubAddressAsFirstLocation = true;
      return draft;
    });
    return true;
  }

  /// Retire le lieu créé depuis l'adresse du siège.
  void _removeClubHeadquartersAsLocation() {
    ref.read(clubSetupProvider.notifier).updateDraft((draft) {
      draft.practiceLocations = draft.practiceLocations
          .where((location) => !location.linkedToHeadquarters)
          .toList();
      draft.useClubAddressAsFirstLocation = false;
      return draft;
    });
  }

  /// Recalcule le lieu siège après un changement de ville, d'adresse ou de sport.
  void _syncClubHeadquartersLocation() {
    final draft = ref.read(clubSetupProvider);
    if (!draft.useClubAddressAsFirstLocation) return;
    final updated = _upsertClubHeadquartersLocation(showErrorIfEmpty: false);
    if (!updated && mounted) {
      // Ville/adresse encore incomplets : retire le lieu HQ sans
      // désactiver la préférence utilisateur (évite de décocher en cours de saisie).
      ref.read(clubSetupProvider.notifier).updateDraft((draft) {
        draft.practiceLocations = draft.practiceLocations
            .where((location) => !location.linkedToHeadquarters)
            .toList();
        return draft;
      });
    }
  }

  void _onUseClubAddressChanged(bool useClubAddress) {
    if (useClubAddress) {
      final added = _upsertClubHeadquartersLocation(showErrorIfEmpty: true);
      if (!added) return;
      return;
    }
    _removeClubHeadquartersAsLocation();
  }

  void _addLocation(PracticeLocation location) {
    ref.read(clubSetupProvider.notifier).updateDraft((draft) {
      draft.practiceLocations = [...draft.practiceLocations, location];
      return draft;
    });
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
      ref.read(clubSetupAnalyticsProvider).trackCompleted(
            sport: draft.sport,
            objectives: draft.objectives,
            memberCountRange: draft.memberCountRange,
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
          child: Text(stepLabel, key: ValueKey(stepLabel)),
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
                  onPickLogo: _pickLogo,
                  onNameChanged: (name) {
                    ref.read(clubSetupProvider.notifier).updateDraft((draft) {
                      draft.name = name;
                      return draft;
                    });
                  },
                  onSportChanged: (sport) {
                    ref.read(clubSetupProvider.notifier).updateDraft((draft) {
                      draft.sport = sport;
                      return draft;
                    });
                    _syncClubHeadquartersLocation();
                  },
                ),
                ObjectivesStep(
                  selected: draft.objectives,
                  onToggle: (key) {
                    ref.read(clubSetupProvider.notifier).toggleObjective(key);
                  },
                ),
                MemberCountStep(
                  memberCountRange: draft.memberCountRange,
                  onChanged: (range) {
                    ref.read(clubSetupProvider.notifier).updateDraft((draft) {
                      draft.memberCountRange = range;
                      return draft;
                    });
                  },
                ),
                HeadquartersStep(
                  cityController: _cityController,
                  postalController: _postalController,
                  addressController: _addressController,
                  addressService: ref.read(frenchAddressServiceProvider),
                  useClubAddressAsFirstLocation:
                      draft.useClubAddressAsFirstLocation,
                  onUseClubAddressChanged: _onUseClubAddressChanged,
                  onFieldChanged: () {
                    ref.read(clubSetupProvider.notifier).updateDraft((draft) {
                      draft.city = _cityController.text;
                      draft.postalCode = _postalController.text;
                      draft.address = _addressController.text;
                      return draft;
                    });
                    _syncClubHeadquartersLocation();
                  },
                ),
                PracticeLocationsStep(
                  sport: draft.sport,
                  fallbackCity: draft.city,
                  locations: draft.practiceLocations,
                  onAdd: _addLocation,
                  onValidationError: _showError,
                  onRemove: (index) {
                    final locations =
                        ref.read(clubSetupProvider).practiceLocations;
                    if (index < 0 || index >= locations.length) return;
                    final removed = locations[index];
                    ref.read(clubSetupProvider.notifier).updateDraft((draft) {
                      draft.practiceLocations =
                          List.of(draft.practiceLocations)..removeAt(index);
                      if (removed.linkedToHeadquarters) {
                        draft.useClubAddressAsFirstLocation = false;
                      }
                      return draft;
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
                ? ViroPortalButton(label: _continueLabel(), onPressed: _next)
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
