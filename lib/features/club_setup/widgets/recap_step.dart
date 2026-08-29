import 'dart:math' as math;
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

/// Étape récapitulatif — deux colonnes distinctes, centrées verticalement.
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
      centerBody: true,
      subtitle: 'Tout est prêt — revenez en arrière pour corriger si besoin.',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ViroCard(
            margin: EdgeInsets.zero,
            padding: const EdgeInsets.all(ViroSpacing.md),
            borderColor: sportAccent.withValues(alpha: 0.55),
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
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: ViroColors.primary800,
                        ),
                      ),
                      const SizedBox(height: ViroSpacing.xs),
                      Text(
                        '${sportEmoji(draft.sport)} ${draft.sport}'
                        '${draft.city.isNotEmpty ? ' · ${draft.city}' : ''}',
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
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _RecapColumn(
                  children: [
                    _RecapPanel(
                      title: 'Identité',
                      icon: ViroIcons.groups,
                      accent: sportAccent,
                      child: _RecapIdentityBody(draft: draft),
                    ),
                    _RecapPanel(
                      title: 'Détails',
                      icon: ViroIcons.trophy,
                      accent: ViroColors.sportYellow,
                      child: _RecapDetailsBody(
                        memberCountRange: draft.memberCountRange,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: ViroSpacing.sm),
              Expanded(
                child: _RecapColumn(
                  children: [
                    _RecapPanel(
                      title: 'Localisation',
                      icon: ViroIcons.place,
                      accent: ViroColors.sportCyan,
                      child: _RecapLocationBody(
                        headquartersLine: headquartersLine,
                        locations: draft.practiceLocations,
                        address: draft.address,
                        postalCode: draft.postalCode,
                        city: draft.city,
                        sport: draft.sport,
                      ),
                    ),
                    _RecapPanel(
                      title: 'Priorités',
                      icon: ViroIcons.calendar,
                      accent: ViroColors.sportOrange,
                      child: _RecapObjectiveChips(
                        objectives: draft.objectives,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RecapColumn extends StatelessWidget {
  const _RecapColumn({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var index = 0; index < children.length; index++) ...[
          if (index > 0) const SizedBox(height: ViroSpacing.sm),
          children[index],
        ],
      ],
    );
  }
}

class _RecapIdentityBody extends StatelessWidget {
  const _RecapIdentityBody({required this.draft});

  final ClubSetupDraft draft;

  @override
  Widget build(BuildContext context) {
    final description = draft.description.trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _RecapLabeledValue(
          label: 'Nom',
          value: draft.name.isEmpty ? 'Non renseigné' : draft.name,
        ),
        const SizedBox(height: ViroSpacing.xs),
        _RecapLabeledValue(
          label: 'Sport',
          value: '${sportEmoji(draft.sport)} ${draft.sport}',
        ),
        const SizedBox(height: ViroSpacing.xs),
        _RecapLabeledValue(
          label: 'Logo',
          value: draft.logoBytes != null ? 'Ajouté' : 'Non ajouté',
          valueColor: draft.logoBytes != null
              ? ViroColors.sportGreen
              : ViroColors.gray600,
        ),
        if (description.isNotEmpty) ...[
          const SizedBox(height: ViroSpacing.xs),
          _RecapLabeledValue(
            label: 'Description',
            value: description,
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
    required this.address,
    required this.postalCode,
    required this.city,
    required this.sport,
  });

  final String headquartersLine;
  final List<PracticeLocation> locations;
  final String address;
  final String postalCode;
  final String city;
  final String sport;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final headquartersIndex = ClubSetupFormat.headquartersLocationIndex(
      address: address,
      postalCode: postalCode,
      city: city,
      sport: sport,
      locations: locations,
    );
    final headquartersMerged = headquartersIndex >= 0;
    final headquartersLocation =
        headquartersMerged ? locations[headquartersIndex] : null;
    final extraLocations = [
      for (var index = 0; index < locations.length; index++)
        if (index != headquartersIndex) locations[index],
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (headquartersMerged)
          _RecapLabeledValue(
            label: 'Siège et lieu 1',
            value: _mergedHeadquartersLine(headquartersLocation!),
          )
        else ...[
          _RecapLabeledValue(
            label: 'Siège',
            value: headquartersLine.isEmpty ? 'Non renseigné' : headquartersLine,
          ),
          if (locations.isEmpty) ...[
            const SizedBox(height: ViroSpacing.xs),
            Text(
              'Aucun lieu',
              style: theme.bodySmall?.copyWith(color: ViroColors.gray400),
            ),
          ],
        ],
        ...extraLocations.asMap().entries.map((entry) {
          final lieuNumber = headquartersMerged ? entry.key + 2 : entry.key + 1;
          return Padding(
            padding: const EdgeInsets.only(top: ViroSpacing.xs),
            child: _RecapLabeledValue(
              label: 'Lieu $lieuNumber',
              value: _locationLine(entry.value),
            ),
          );
        }),
      ],
    );
  }

  String _mergedHeadquartersLine(PracticeLocation location) {
    final locationLine = _locationLine(location);
    if (locationLine.isNotEmpty) return locationLine;
    return headquartersLine.isEmpty ? 'Non renseigné' : headquartersLine;
  }

  String _locationLine(PracticeLocation location) {
    final locationAddress = location.address?.trim();
    if (locationAddress != null && locationAddress.isNotEmpty) {
      if (location.name.isNotEmpty &&
          locationAddress.toLowerCase().contains(location.name.toLowerCase())) {
        return locationAddress;
      }
      return '${location.name}\n$locationAddress';
    }
    return location.name;
  }
}

class _RecapObjectiveChips extends StatelessWidget {
  const _RecapObjectiveChips({required this.objectives});

  final Set<String> objectives;

  static const _maxVisibleObjectives = 6;

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
    final visibleObjectives =
        orderedObjectives.take(_maxVisibleObjectives).toList();
    final hiddenCount = orderedObjectives.length - visibleObjectives.length;

    return LayoutBuilder(
      builder: (context, constraints) {
        final chipMaxWidth = constraints.maxWidth * 0.82;
        final chipSpecs = [
          ...visibleObjectives.map(
            (objectiveKey) => (
              label: ClubObjectives.label(objectiveKey),
              accent: ClubSetupUi.objectiveAccent(objectiveKey),
            ),
          ),
          if (hiddenCount > 0)
            (
              label: '+$hiddenCount',
              accent: ViroColors.gray400,
            ),
        ];

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var index = 0; index < chipSpecs.length; index++) ...[
              if (index > 0) const SizedBox(height: ViroSpacing.xs),
              Align(
                alignment: index.isEven
                    ? Alignment.centerLeft
                    : Alignment.centerRight,
                child: _RecapChip(
                  label: chipSpecs[index].label,
                  accent: chipSpecs[index].accent,
                  maxWidth: chipMaxWidth,
                  textAlign:
                      index.isEven ? TextAlign.start : TextAlign.end,
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _RecapDetailsBody extends StatelessWidget {
  const _RecapDetailsBody({required this.memberCountRange});

  final String? memberCountRange;

  @override
  Widget build(BuildContext context) {
    return _RecapLabeledValue(
      label: 'Effectif',
      value: memberCountRange != null
          ? ClubMemberCountRanges.recapLabel(memberCountRange!)
          : 'Non renseigné',
    );
  }
}

class _RecapLabeledValue extends StatelessWidget {
  const _RecapLabeledValue({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.labelSmall?.copyWith(
            color: ViroColors.gray900,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: ViroSpacing.xs),
        Text(
          value,
          style: theme.bodySmall?.copyWith(
            color: valueColor ?? ViroColors.gray600,
            height: 1.35,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _RecapChip extends StatelessWidget {
  const _RecapChip({
    required this.label,
    required this.accent,
    this.maxWidth,
    this.textAlign = TextAlign.start,
  });

  final String label;
  final Color accent;
  final double? maxWidth;
  final TextAlign textAlign;

  static const _horizontalPadding = ViroSpacing.sm;
  static const _verticalPadding = ViroSpacing.xs;
  static const _borderWidth = 1.0;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.labelSmall?.copyWith(
          color: accent,
          fontWeight: FontWeight.w600,
          height: 1.2,
        );
    final chromeWidth = (_horizontalPadding + _borderWidth) * 2;
    final textMaxWidth = maxWidth == null
        ? double.infinity
        : math.max(0.0, maxWidth! - chromeWidth);

    final painter = TextPainter(
      text: TextSpan(text: label, style: style),
      textDirection: TextDirection.ltr,
      textScaler: MediaQuery.textScalerOf(context),
    )..layout(maxWidth: textMaxWidth);

    try {
      var longestLine = painter.width;
      for (final line in painter.computeLineMetrics()) {
        longestLine = math.max(longestLine, line.width);
      }

      final chipWidth = maxWidth == null
          ? null
          : (longestLine + chromeWidth).clamp(0.0, maxWidth!);

      return Container(
        width: chipWidth,
        padding: const EdgeInsets.symmetric(
          horizontal: _horizontalPadding,
          vertical: _verticalPadding,
        ),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
          border: Border.all(color: accent.withValues(alpha: 0.35)),
        ),
        child: Text(
          label,
          style: style,
          textAlign: textAlign,
        ),
      );
    } finally {
      painter.dispose();
    }
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
      borderColor: accent.withValues(alpha: 0.55),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              _RecapPanelIcon(icon: icon, accent: accent),
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

class _RecapPanelIcon extends StatelessWidget {
  const _RecapPanelIcon({required this.icon, required this.accent});

  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(6),
      ),
      alignment: Alignment.center,
      child: ViroIcon(icon, color: accent, size: 14),
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
