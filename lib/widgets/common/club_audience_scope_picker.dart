import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/compare_team_categories.dart';

/// Mode de ciblage pour un canal admin (hors « tout le club »).
enum ClubAudienceScopeKind {
  categories,
  teams,
  parents,
}

/// Sélection multi d’une seule famille de cibles.
final class ClubAudienceScopeSelection {
  const ClubAudienceScopeSelection({
    required this.kind,
    required this.ids,
  });

  final ClubAudienceScopeKind kind;
  final Set<String> ids;

  ClubAudienceScopeSelection copyWith({
    ClubAudienceScopeKind? kind,
    Set<String>? ids,
  }) {
    return ClubAudienceScopeSelection(
      kind: kind ?? this.kind,
      ids: ids ?? this.ids,
    );
  }
}

/// Picker réutilisable : un mode (catégories / équipes / parents) puis chips
/// multi — valeurs connues uniquement, pas de saisie libre.
class ClubAudienceScopePicker extends StatelessWidget {
  const ClubAudienceScopePicker({
    super.key,
    required this.teams,
    required this.value,
    required this.onChanged,
    this.sport,
    this.accentColor,
  });

  final List<ClubTeam> teams;
  final ClubAudienceScopeSelection value;
  final ValueChanged<ClubAudienceScopeSelection> onChanged;

  /// Sport du club pour trier les catégories dans l’ordre catalogue.
  final String? sport;

  /// Couleur de marque du club (chips de sélection).
  final Color? accentColor;

  List<_ScopeOption> get _options {
    if (value.kind == ClubAudienceScopeKind.categories) {
      final categories = sortTeamCategories(
        teams.map((team) => team.category ?? ''),
        sport: sport,
      );
      return [
        for (final category in categories)
          _ScopeOption(id: category, label: category),
      ];
    }

    final selectable = teams.where((team) {
      if (value.kind == ClubAudienceScopeKind.parents) {
        return team.playerIds.any((id) => id.trim().isNotEmpty);
      }
      return team.name.trim().isNotEmpty;
    }).toList()
      ..sort((a, b) {
        final byCategory = compareTeamCategories(
          a.category ?? '',
          b.category ?? '',
        );
        if (byCategory != 0) return byCategory;
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });

    return [
      for (final team in selectable)
        _ScopeOption(
          id: team.id,
          label: value.kind == ClubAudienceScopeKind.parents
              ? AppCopy.chat.parentsOfTeamLabel(team.name)
              : team.category != null && team.category!.isNotEmpty
                  ? '${team.name} (${team.category})'
                  : team.name,
        ),
    ];
  }

  String get _optionsHint {
    return switch (value.kind) {
      ClubAudienceScopeKind.categories =>
        AppCopy.chat.channelOptionsCategoriesHint,
      ClubAudienceScopeKind.teams => AppCopy.chat.channelOptionsTeamsHint,
      ClubAudienceScopeKind.parents => AppCopy.chat.channelOptionsParentsHint,
    };
  }

  @override
  Widget build(BuildContext context) {
    final accent =
        accentColor ?? Theme.of(context).colorScheme.primary;
    final onAccent =
        accent.computeLuminance() > 0.45 ? ViroColors.primary900 : ViroColors.white;
    final options = _options;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentedButton<ClubAudienceScopeKind>(
          segments: [
            for (final kind in ClubAudienceScopeKind.values)
              ButtonSegment(
                value: kind,
                label: Text(_kindLabel(kind)),
              ),
          ],
          selected: {value.kind},
          onSelectionChanged: (next) {
            final kind = next.first;
            if (kind == value.kind) return;
            onChanged(ClubAudienceScopeSelection(kind: kind, ids: const {}));
          },
          style: ButtonStyle(
            visualDensity: VisualDensity.compact,
            textStyle: WidgetStatePropertyAll(
              theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ),
        const SizedBox(height: ViroSpacing.sm),
        if (options.isEmpty)
          Text(
            value.kind == ClubAudienceScopeKind.categories
                ? AppCopy.chat.noCategoriesForChannel
                : value.kind == ClubAudienceScopeKind.parents
                    ? AppCopy.chat.noTeamsWithPlayersForChannel
                    : AppCopy.chat.noTeamsForChannel,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: ViroColors.gray400,
            ),
          )
        else ...[
          Text(
            _optionsHint,
            style: theme.textTheme.labelSmall?.copyWith(
              color: ViroColors.gray400,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: ViroSpacing.xs),
          Wrap(
            spacing: ViroSpacing.sm,
            runSpacing: ViroSpacing.sm,
            children: options.map((option) {
              final selected = value.ids.contains(option.id);
              return FilterChip(
                label: Text(option.label),
                selected: selected,
                showCheckmark: true,
                onSelected: (isOn) {
                  final next = {...value.ids};
                  if (isOn) {
                    next.add(option.id);
                  } else {
                    next.remove(option.id);
                  }
                  onChanged(value.copyWith(ids: next));
                },
                selectedColor: accent,
                checkmarkColor: onAccent,
                backgroundColor: accent.withValues(alpha: 0.08),
                labelStyle: TextStyle(
                  color: selected ? onAccent : ViroColors.gray900,
                  fontWeight: FontWeight.w600,
                ),
                side: BorderSide(
                  color: selected
                      ? accent
                      : accent.withValues(alpha: 0.28),
                  width: 1.5,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              );
            }).toList(),
          ),
        ],
      ],
    );
  }

  String _kindLabel(ClubAudienceScopeKind kind) {
    return switch (kind) {
      ClubAudienceScopeKind.categories => AppCopy.chat.scopeCategories,
      ClubAudienceScopeKind.teams => AppCopy.chat.scopeTeams,
      ClubAudienceScopeKind.parents => AppCopy.chat.scopeParents,
    };
  }
}

final class _ScopeOption {
  const _ScopeOption({required this.id, required this.label});

  final String id;
  final String label;
}
