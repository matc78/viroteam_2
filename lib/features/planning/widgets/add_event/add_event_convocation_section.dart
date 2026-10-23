import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/planning/widgets/add_event/add_event_field_label.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/lists/convocation_player_list_tile.dart';

/// Match : joueurs de l'équipe choisie, tous convoqués par défaut ; le coach
/// décoche ceux qui ne sont pas du match (et peut les recocher).
class AddEventConvocationSection extends StatelessWidget {
  /// [players] `null` = chargement en cours.
  const AddEventConvocationSection({
    super.key,
    required this.players,
    required this.excludedIds,
    required this.accentColor,
    required this.enabled,
    required this.onPlayerToggled,
  });

  final List<({String id, ClubMember member})>? players;
  final Set<String> excludedIds;
  final Color accentColor;
  final bool enabled;
  final ValueChanged<String> onPlayerToggled;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final hintStyle = Theme.of(context)
        .textTheme
        .bodySmall
        ?.copyWith(color: palette.textSecondary);
    final entries = players;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: AddEventFieldLabel(
                AppCopy.planning.convocationSectionTitle,
                accentColor: accentColor,
              ),
            ),
            if (entries != null && entries.isNotEmpty)
              Text(
                AppCopy.planning.convocationCount(
                  entries.where((p) => !excludedIds.contains(p.id)).length,
                  entries.length,
                ),
                style: hintStyle,
              ),
          ],
        ),
        if (entries == null)
          const Padding(
            padding: EdgeInsets.all(ViroSpacing.md),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (entries.isEmpty)
          Text(AppCopy.planning.teamNoPlayers, style: hintStyle)
        else ...[
          Text(AppCopy.planning.matchConvocationHint, style: hintStyle),
          for (final entry in entries)
            ConvocationPlayerListTile(
              key: ValueKey(entry.id),
              member: entry.member,
              convoked: !excludedIds.contains(entry.id),
              enabled: enabled,
              onChanged: (_) => onPlayerToggled(entry.id),
            ),
        ],
        const SizedBox(height: ViroSpacing.md),
      ],
    );
  }
}
