import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club_setup/models/club_setup_draft.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_format.dart';
import 'package:viro_team_v2/features/club_setup/utils/club_setup_ui.dart';
import 'package:viro_team_v2/features/club_setup/widgets/setup_step_shell.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/utils/sport_emoji.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Nombre de priorités affichées avant l'indicateur « … ».
const _recapVisibleObjectives = 2;

/// Nombre de lieux listés avant l'indicateur « … ».
const _recapVisibleLocations = 1;

/// Étape récapitulatif — grille compacte, scroll si besoin.
class RecapStep extends StatelessWidget {
  const RecapStep({super.key, required this.draft});

  final ClubSetupDraft draft;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final sportAccent = ClubSetupUi.sportAccent(draft.sport);
    final headquartersLine = ClubSetupFormat.headquartersLine(
      address: draft.address,
      postalCode: draft.postalCode,
      city: draft.city,
    );

    return SetupStepShell(
      subtitle: 'Tout est prêt — revenez en arrière pour corriger si besoin.',
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ViroCard(
              margin: EdgeInsets.zero,
              padding: const EdgeInsets.all(ViroSpacing.md),
              child: Row(
                children: [
                  _RecapLogo(
                    logoBytes: draft.logoBytes,
                    sport: draft.sport,
                    accent: sportAccent,
                  ),
                  const SizedBox(width: ViroSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          draft.name.isEmpty ? 'Nom du club' : draft.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: ViroColors.primary800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${sportEmoji(draft.sport)} ${draft.sport}'
                          '${draft.city.isNotEmpty ? ' · ${draft.city}' : ''}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.bodySmall?.copyWith(
                            color: sportAccent,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _RecapPanel(
                      title: 'Identité',
                      icon: ViroIcons.groups,
                      accent: sportAccent,
                      child: _RecapIdentityBody(draft: draft),
                    ),
                  ),
                  const SizedBox(width: ViroSpacing.sm),
                  Expanded(
                    child: _RecapPanel(
                      title: 'Localisation',
                      icon: ViroIcons.place,
                      accent: ViroColors.sportCyan,
                      child: _RecapLocationBody(
                        headquartersLine: headquartersLine,
                        locations: draft.practiceLocations,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _RecapPanel(
                      title: 'Priorités',
                      icon: ViroIcons.calendar,
                      accent: ViroColors.sportOrange,
                      child: _RecapObjectiveChips(objectives: draft.objectives),
                    ),
                  ),
                  const SizedBox(width: ViroSpacing.sm),
                  Expanded(
                    child: _RecapPanel(
                      title: 'Détails',
                      icon: ViroIcons.trophy,
                      accent: ViroColors.sportYellow,
                      child: _RecapDetailsBody(
                        memberCountRange: draft.memberCountRange,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecapIdentityBody extends StatelessWidget {
  const _RecapIdentityBody({required this.draft});

  final ClubSetupDraft draft;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final description = draft.description.trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          description.isNotEmpty ? description : 'Pas de description',
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: theme.bodySmall?.copyWith(
            color: description.isNotEmpty
                ? ViroColors.gray600
                : ViroColors.gray400,
            height: 1.35,
          ),
        ),
        if (draft.logoBytes != null) ...[
          const SizedBox(height: ViroSpacing.xs),
          Text(
            'Logo ajouté',
            style: theme.labelSmall?.copyWith(
              color: ViroColors.sportGreen,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }
}

class _RecapLocationBody extends StatelessWidget {
  const _RecapLocationBody({
    required this.headquartersLine,
    required this.locations,
  });

  final String headquartersLine;
  final List<PracticeLocation> locations;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final visibleLocations = locations.take(_recapVisibleLocations);
    final hiddenLocationCount =
        locations.length - visibleLocations.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Siège',
          style: theme.labelSmall?.copyWith(
            color: ViroColors.gray400,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          headquartersLine.isEmpty ? 'Non renseigné' : headquartersLine,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: theme.bodySmall?.copyWith(
            color: ViroColors.gray600,
            height: 1.35,
          ),
        ),
        const SizedBox(height: ViroSpacing.xs),
        Text(
          'Lieux (${locations.length})',
          style: theme.labelSmall?.copyWith(
            color: ViroColors.gray400,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        if (locations.isEmpty)
          Text(
            'Aucun lieu',
            style: theme.bodySmall?.copyWith(color: ViroColors.gray400),
          )
        else ...[
          ...visibleLocations.map(
            (location) => Padding(
              padding: const EdgeInsets.only(bottom: ViroSpacing.xs),
              child: Text(
                _locationLine(location),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.bodySmall?.copyWith(
                  color: ViroColors.gray600,
                  height: 1.3,
                ),
              ),
            ),
          ),
          if (hiddenLocationCount > 0)
            Text(
              '…',
              style: theme.labelSmall?.copyWith(
                color: ViroColors.gray400,
                fontWeight: FontWeight.w700,
              ),
            ),
        ],
      ],
    );
  }

  String _locationLine(PracticeLocation location) {
    final address = location.address?.trim();
    if (address != null && address.isNotEmpty) {
      return '${location.name} · $address';
    }
    return location.name;
  }
}

class _RecapObjectiveChips extends StatelessWidget {
  const _RecapObjectiveChips({required this.objectives});

  final Set<String> objectives;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    if (objectives.isEmpty) {
      return Text(
        'Aucune priorité',
        style: theme.bodySmall?.copyWith(color: ViroColors.gray400),
      );
    }

    final orderedObjectives = ClubObjectives.all
        .where(objectives.contains)
        .toList(growable: false);
    final visibleObjectives = orderedObjectives.take(_recapVisibleObjectives);
    final hasHiddenObjectives =
        orderedObjectives.length > visibleObjectives.length;

    return Wrap(
      spacing: ViroSpacing.xs,
      runSpacing: ViroSpacing.xs,
      children: [
        ...visibleObjectives.map(
          (objectiveKey) => _RecapChip(
            label: ClubObjectives.label(objectiveKey),
            accent: ClubSetupUi.objectiveAccent(objectiveKey),
          ),
        ),
        if (hasHiddenObjectives)
          _RecapChip(
            label: '…',
            accent: ViroColors.gray400,
          ),
      ],
    );
  }
}

class _RecapDetailsBody extends StatelessWidget {
  const _RecapDetailsBody({required this.memberCountRange});

  final String? memberCountRange;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          memberCountRange != null
              ? 'Taille : ${ClubMemberCountRanges.label(memberCountRange!)}'
              : 'Taille : non renseignée',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.bodySmall?.copyWith(
            color: memberCountRange != null
                ? ViroColors.gray600
                : ViroColors.gray400,
          ),
        ),
        const SizedBox(height: ViroSpacing.xs),
        Row(
          children: [
            Container(
              width: 14,
              height: 14,
              decoration: const BoxDecoration(
                color: ViroColors.primary600,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: ViroSpacing.xs),
            Expanded(
              child: Text(
                'Couleur bleue par défaut',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.labelSmall?.copyWith(color: ViroColors.gray600),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _RecapChip extends StatelessWidget {
  const _RecapChip({
    required this.label,
    required this.accent,
  });

  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.sm,
        vertical: ViroSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
        border: Border.all(color: accent.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: accent,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

class _RecapPanel extends StatelessWidget {
  const _RecapPanel({
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
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.all(ViroSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(6),
                ),
                alignment: Alignment.center,
                child: ViroIcon(icon, color: accent, size: 14),
              ),
              const SizedBox(width: ViroSpacing.xs),
              Expanded(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: ViroColors.primary800,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: ViroSpacing.xs),
          child,
        ],
      ),
    );
  }
}

class _RecapLogo extends StatelessWidget {
  const _RecapLogo({
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
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: accent.withValues(alpha: 0.35)),
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
          : Text(sportEmoji(sport), style: const TextStyle(fontSize: 20)),
    );
  }
}
