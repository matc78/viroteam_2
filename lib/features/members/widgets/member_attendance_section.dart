import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club/providers/club_attendance_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_category_groups.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/lists/member_team_attendance_list_tile.dart';

/// Fiche membre : présences de la saison (joueur ou coach), une ligne par
/// équipe (taux de oui, convocations, entraînements et matchs). Visible par
/// tous ; masquée hors roster ; état vide si aucune convocation passée.
class MemberAttendanceSection extends ConsumerWidget {
  const MemberAttendanceSection({
    super.key,
    required this.clubId,
    required this.memberId,
    required this.accent,
    required this.borderColor,
    required this.titleBuilder,
  });

  final String clubId;
  final String memberId;
  final Color accent;
  final Color borderColor;

  /// Titre de section dans le style de la fiche.
  final Widget Function(String label) titleBuilder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(
      memberSeasonAttendanceProvider((clubId: clubId, memberId: memberId)),
    );
    return async.when(
      loading: () => const SizedBox.shrink(),
      error: (error, _) => _section(
        context,
        child: Text(
          kDebugMode
              ? '${AppCopy.attendance.loadError}\n$error'
              : AppCopy.attendance.loadError,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: context.viroPalette.textSecondary,
          ),
        ),
      ),
      data: (view) {
        if (!view.onRoster) return const SizedBox.shrink();
        if (view.rows.isEmpty) {
          return _section(
            context,
            child: Text(
              AppCopy.attendance.memberEmpty,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: context.viroPalette.textSecondary,
              ),
            ),
          );
        }
        final tones = ref.watch(teamCategoryTonesProvider(clubId));
        return _section(
          context,
          child: Column(
            children: [
              for (final row in view.rows)
                MemberTeamAttendanceListTile(
                  key: ValueKey(row.attendance.team.id),
                  row: row.attendance,
                  roles: row.roles,
                  categoryColor: tones.isEmpty
                      ? null
                      : teamCategoryToneOf(
                          tones,
                          row.attendance.team,
                        ).color,
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _section(BuildContext context, {required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: ViroSpacing.lg),
        titleBuilder(AppCopy.attendance.memberSection),
        const SizedBox(height: ViroSpacing.sm),
        ViroCard(
          margin: EdgeInsets.zero,
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.md,
            vertical: ViroSpacing.sm,
          ),
          borderColor: borderColor,
          accentColor: accent,
          child: child,
        ),
      ],
    );
  }
}
