import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club_setup/club_setup_steps.dart';
import 'package:viro_team_v2/features/club_setup/models/club_setup_draft.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_ui.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_step_shell.dart';
import 'package:viro_team_v2/utils/sport_emoji.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Étape identité — logo, nom et sport.
class IdentityStep extends StatelessWidget {
  const IdentityStep({
    super.key,
    required this.draft,
    required this.nameController,
    required this.onPickLogo,
    required this.onNameChanged,
    required this.onSportChanged,
  });

  final ClubSetupDraft draft;
  final TextEditingController nameController;
  final VoidCallback onPickLogo;
  final void Function(String name) onNameChanged;
  final void Function(String sport) onSportChanged;

  @override
  Widget build(BuildContext context) {
    final stepAccent = ClubSetupUi.stepAccent(ClubSetupSteps.identity);
    final sportAccent = draft.sport.trim().isEmpty
        ? stepAccent
        : ClubSetupUi.sportAccent(draft.sport);

    return SetupStepShell(
      centerBody: true,
      subtitle: 'Nom et sport pour démarrer. Le logo, c\'est bonus.',
      child: Column(
        mainAxisSize: MainAxisSize.min,
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
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: ViroColors.primary800,
                ),
          ),
          const SizedBox(height: ViroSpacing.xs),
          SizedBox(
            height: 168,
            child: GridView.builder(
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                mainAxisSpacing: ViroSpacing.xs,
                crossAxisSpacing: ViroSpacing.xs,
                mainAxisExtent: 36,
              ),
              itemCount: ClubSports.all.length,
              itemBuilder: (context, index) {
                final sport = ClubSports.all[index];
                final selected = draft.sport == sport;
                final accent = ClubSetupUi.sportAccent(sport);
                return _SportChip(
                  label: '${sportEmoji(sport)} $sport',
                  selected: selected,
                  accent: accent,
                  onTap: () => onSportChanged(sport),
                );
              },
            ),
          ),
        ],
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
      borderRadius: BorderRadius.circular(16),
      child: AnimatedContainer(
        duration: ViroMotion.fast,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          color: selected
              ? accent.withValues(alpha: 0.14)
              : ViroColors.surfaceCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? accent : ViroColors.primary100,
            width: selected ? 2 : 1,
          ),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: selected ? accent : ViroColors.gray600,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                fontSize: 11,
              ),
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
      width: 64,
      height: 64,
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
      ),
      alignment: Alignment.center,
      child: hasLogo
          ? null
          : ViroIcon(ViroIcons.image, color: accent, size: 26),
    );
  }
}
