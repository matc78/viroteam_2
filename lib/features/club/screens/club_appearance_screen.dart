import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/widgets/club_appearance_preview.dart';
import 'package:viro_team_v2/features/club/widgets/club_brand_color_picker.dart';
import 'package:viro_team_v2/features/club/widgets/club_context_avatar.dart';
import 'package:viro_team_v2/features/club_setup/club_setup_defaults.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Écran admin : logo et couleur de marque du club.
class ClubAppearanceScreen extends ConsumerStatefulWidget {
  const ClubAppearanceScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<ClubAppearanceScreen> createState() =>
      _ClubAppearanceScreenState();
}

class _ClubAppearanceScreenState extends ConsumerState<ClubAppearanceScreen> {
  String? _selectedPrimaryHex;
  String? _selectedSecondaryHex;
  Uint8List? _logoPreviewBytes;
  bool _saving = false;

  Future<void> _pickLogo() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 85,
    );
    if (file == null || !mounted) return;
    final bytes = await file.readAsBytes();
    setState(() => _logoPreviewBytes = bytes);
  }

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final clubAsync = ref.watch(clubProvider(clubId));
    final member = ref.watch(clubMemberProvider(clubId)).value;

    if (member != null && member.role != MemberRoles.admin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.pop();
      });
      return const ViroScaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final club = clubAsync.value;
    final rawStoredHex =
        club?.brandColorHex ?? ClubSetupDefaults.brandColorHex;
    final storedParts = splitBrandColorHex(sanitizeBrandColorHex(rawStoredHex));
    final previewPrimaryHex = _selectedPrimaryHex ?? storedParts.primary;
    final fallbackAccent = ref.watch(clubMemberAccentProvider(clubId));
    final previewAccent =
        parseBrandColorHex(previewPrimaryHex) ?? fallbackAccent;

    return ClubAccentTheme(
      accentColor: previewAccent,
      child: ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () => context.pop(),
        ),
        title: const Text('Apparence du club'),
      ),
      body: clubAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const ViroErrorState(),
        data: (club) {
          if (club == null) {
            return const Center(child: Text('Club introuvable'));
          }

          final rawStoredHex =
              club.brandColorHex ?? ClubSetupDefaults.brandColorHex;
          final storedHex = sanitizeBrandColorHex(rawStoredHex);
          final storedParts = splitBrandColorHex(storedHex);
          final currentPrimaryHex =
              _selectedPrimaryHex ?? storedParts.primary;
          final currentSecondaryHex =
              _selectedSecondaryHex ?? storedParts.secondary;
          final currentHex = encodeBrandColorHex(
            primary: currentPrimaryHex,
            secondary: currentSecondaryHex,
          );
          final brandColors = resolveClubBrandColors(
            brandColorHex: currentHex,
            clubId: clubId,
          );
          final colorChanged = !clubBrandColorsMatch(currentHex, rawStoredHex);
          final logoChanged = _logoPreviewBytes != null;
          final hasChanges = colorChanged || logoChanged;

          return ListView(
            padding: const EdgeInsets.all(ViroSpacing.screenHorizontal),
            children: [
              Text(
                'Logo',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: brandColors.primary,
                    ),
              ),
              const SizedBox(height: ViroSpacing.sm),
              Center(
                child: ViroPressable(
                  onTap: _pickLogo,
                  borderRadius: BorderRadius.circular(20),
                  child: Column(
                    children: [
                      ClubContextAvatar(
                        club: club,
                        accentColor: brandColors.primary,
                        logoPreviewBytes: _logoPreviewBytes,
                        size: 88,
                        borderRadius: 20,
                      ),
                      const SizedBox(height: ViroSpacing.xs),
                      Text(
                        _logoPreviewBytes != null
                            ? 'Modifier le logo'
                            : 'Changer le logo',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: brandColors.primary,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: ViroSpacing.lg),
              ClubAppearancePreview(
                club: club,
                brandColors: brandColors,
                logoPreviewBytes: _logoPreviewBytes,
              ),
              const SizedBox(height: ViroSpacing.lg),
              Text(
                'Couleur du club',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: brandColors.primary,
                    ),
              ),
              const SizedBox(height: ViroSpacing.xs),
              Text(
                'Utilisée sur la page club, le planning et les cartes.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: ViroColors.gray600,
                    ),
              ),
              const SizedBox(height: ViroSpacing.md),
              Center(
                child: ClubBrandColorPicker(
                  selectedPrimaryHex: currentPrimaryHex,
                  selectedSecondaryHex: currentSecondaryHex,
                  onPrimarySelected: (hex) {
                    setState(() {
                      _selectedPrimaryHex = hex;
                      if (clubBrandColorsMatch(_selectedSecondaryHex, hex)) {
                        _selectedSecondaryHex = null;
                      }
                    });
                  },
                  onSecondaryToggled: (hex) {
                    setState(() => _selectedSecondaryHex = hex);
                  },
                ),
              ),
              const SizedBox(height: ViroSpacing.xl),
              ViroPrimaryButton(
                label: 'Enregistrer',
                isLoading: _saving,
                onPressed: !hasChanges || _saving
                    ? null
                    : () => _save(
                          club: club,
                          brandColorHex: currentHex,
                          colorChanged: colorChanged,
                          logoChanged: logoChanged,
                        ),
              ),
              const SizedBox(height: ViroSpacing.lg),
            ],
          );
        },
      ),
      ),
    );
  }

  Future<void> _save({
    required Club club,
    required String brandColorHex,
    required bool colorChanged,
    required bool logoChanged,
  }) async {
    setState(() => _saving = true);
    try {
      final clubService = ref.read(clubServiceProvider);
      if (logoChanged && _logoPreviewBytes != null) {
        await clubService.updateClubLogo(
          clubId: widget.clubId,
          logoBytes: _logoPreviewBytes!,
        );
      }
      if (colorChanged) {
        await clubService.updateBrandColor(
          clubId: widget.clubId,
          brandColorHex: brandColorHex,
        );
      }
      invalidateClubVisualCaches(ref, widget.clubId);
      if (mounted) {
        ViroSnackBar.show(context, 'Apparence enregistrée');
        context.pop();
      }
    } catch (_) {
      if (mounted) {
        ViroSnackBar.show(context, 'Enregistrement impossible, réessayez');
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}
