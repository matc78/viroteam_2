import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/widgets/club_brand_color_picker.dart';
import 'package:viro_team_v2/features/club_setup/models/club_setup_draft.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_ui.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_step_shell.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/sport_emoji.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Étape identité — nom, sport, logo et description.
class IdentityStep extends StatelessWidget {
  const IdentityStep({
    super.key,
    required this.draft,
    required this.nameController,
    required this.descriptionController,
    required this.onPickLogo,
    required this.onNameChanged,
    required this.onSportChanged,
    required this.onBrandColorChanged,
    required this.onDescriptionChanged,
  });

  final ClubSetupDraft draft;
  final TextEditingController nameController;
  final TextEditingController descriptionController;
  final VoidCallback onPickLogo;
  final void Function(String name) onNameChanged;
  final void Function(String sport) onSportChanged;
  final void Function(String brandColorHex) onBrandColorChanged;
  final VoidCallback onDescriptionChanged;

  @override
  Widget build(BuildContext context) {
    final sportAccent = ClubSetupUi.sportAccent(draft.sport);
    final brandParts = splitBrandColorHex(draft.brandColorHex);

    return SetupStepShell(
      subtitle: 'Nom et sport pour démarrer. Logo et description, c\'est bonus.',
      child: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: ViroPressable(
                onTap: onPickLogo,
                borderRadius: BorderRadius.circular(40),
                child: _LogoPreview(
                  logoBytes: draft.logoBytes,
                  sport: draft.sport,
                  accent: sportAccent,
                ),
              ),
            ),
            const SizedBox(height: ViroSpacing.xs),
            Center(
              child: Text(
                draft.logoBytes != null
                    ? 'Modifier le logo'
                    : 'Ajouter un logo (optionnel)',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: sportAccent,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            TextFormField(
              controller: nameController,
              decoration: const InputDecoration(
                labelText: 'Nom du club',
                hintText: 'Ex. Viroflay Volley club',
                isDense: true,
              ),
              onChanged: onNameChanged,
            ),
            const SizedBox(height: ViroSpacing.sm),
            Text(
              'Sport pratiqué',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: ViroColors.primary800,
                  ),
            ),
            const SizedBox(height: ViroSpacing.xs),
            Center(
              child: Wrap(
                alignment: WrapAlignment.center,
                spacing: ViroSpacing.xs,
                runSpacing: ViroSpacing.xs,
                children: ClubSports.all.map((sport) {
                  final selected = draft.sport == sport;
                  final accent = ClubSetupUi.sportAccent(sport);
                  return _SportChip(
                    label: '${sportEmoji(sport)} $sport',
                    selected: selected,
                    accent: accent,
                    onTap: () => onSportChanged(sport),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            Text(
              'Couleur du club',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: ViroColors.primary800,
                  ),
            ),
            const SizedBox(height: ViroSpacing.xs),
            Center(
              child: ClubBrandColorPicker(
                selectedPrimaryHex: brandParts.primary,
                selectedSecondaryHex: brandParts.secondary,
                onPrimarySelected: (hex) {
                  onBrandColorChanged(
                    encodeBrandColorHex(
                      primary: hex,
                      secondary: brandParts.secondary,
                    ),
                  );
                },
                onSecondaryToggled: (hex) {
                  onBrandColorChanged(
                    encodeBrandColorHex(
                      primary: brandParts.primary,
                      secondary: hex,
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            TextFormField(
              controller: descriptionController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Description courte (optionnel)',
                hintText: 'Club fondé en 1985…',
                alignLabelWithHint: true,
                isDense: true,
              ),
              onChanged: (_) => onDescriptionChanged(),
            ),
          ],
        ),
      ),
    );
  }
}

class _SportChip extends StatelessWidget {
  const _SportChip({
    required this.label,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ViroPressable(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: AnimatedContainer(
        duration: ViroMotion.fast,
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.sm + 2,
          vertical: ViroSpacing.xs + 2,
        ),
        decoration: BoxDecoration(
          color: selected ? accent.withValues(alpha: 0.14) : ViroColors.surfaceCard,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: selected ? accent : ViroColors.primary100,
            width: selected ? 2 : 1,
          ),
          boxShadow: selected ? ViroMotion.cardShadow(elevated: false) : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (selected) ...[
              ViroIcon(ViroIcons.check, color: accent, size: 16),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: selected ? accent : ViroColors.gray600,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LogoPreview extends StatelessWidget {
  const _LogoPreview({
    required this.logoBytes,
    required this.sport,
    required this.accent,
  });

  final Uint8List? logoBytes;
  final String sport;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final hasLogo = logoBytes != null;

    return Container(
      width: 72,
      height: 72,
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        shape: BoxShape.circle,
        border: Border.all(color: accent.withValues(alpha: 0.45), width: 2),
        image: hasLogo
            ? DecorationImage(
                image: MemoryImage(logoBytes!),
                fit: BoxFit.cover,
              )
            : null,
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.2),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: hasLogo
          ? null
          : Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ViroIcon(ViroIcons.image, color: accent, size: 28),
                const SizedBox(height: 4),
                Text(sportEmoji(sport), style: const TextStyle(fontSize: 20)),
              ],
            ),
    );
  }
}
