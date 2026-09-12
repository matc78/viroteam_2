import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_activity_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/lists/club_activity_list_tile.dart';

/// Journal des dernières actions du club (coach / admin).
class ClubActivityScreen extends ConsumerWidget {
  const ClubActivityScreen({super.key, required this.clubId});

  final String clubId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(clubActivityProvider(clubId));
    final accent = ref.watch(clubManagementAccentProvider(clubId));

    return ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () => context.pop(),
        ),
        title: Text(AppCopy.activity.screenTitle),
      ),
      body: eventsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => ViroErrorState(
          message: AppCopy.activity.loadError,
        ),
        data: (events) {
          if (events.isEmpty) {
            return ViroEmptyState(
              icon: ViroIcons.clock,
              message:
                  '${AppCopy.activity.emptyTitle}\n${AppCopy.activity.emptyBody}',
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.symmetric(
              horizontal: ViroSpacing.screenHorizontal,
              vertical: ViroSpacing.md,
            ),
            itemCount: events.length,
            itemBuilder: (context, index) {
              return ClubActivityListTile(
                event: events[index],
                accentColor: accent,
              );
            },
          );
        },
      ),
    );
  }
}
