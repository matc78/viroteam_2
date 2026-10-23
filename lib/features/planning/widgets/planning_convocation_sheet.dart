import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/lists/convocation_player_list_tile.dart';

enum _ConvocationScope { single, following }

/// Sheet coach : retirer / réintégrer des joueurs convoqués sur un événement
/// (et ses séances suivantes pour une série).
class PlanningConvocationSheet extends ConsumerStatefulWidget {
  const PlanningConvocationSheet({
    super.key,
    required this.clubId,
    required this.event,
    required this.scrollController,
  });

  final String clubId;
  final ClubEvent event;
  final ScrollController scrollController;

  /// Ouvre la sheet. Retourne `true` si des convocations ont changé.
  static Future<bool> show({
    required BuildContext context,
    required String clubId,
    required ClubEvent event,
  }) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => Consumer(
        builder: (context, sheetRef, _) {
          final accent = sheetRef.watch(clubMemberAccentProvider(clubId));
          return ClubAccentTheme(
            accentColor: accent,
            child: DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.75,
              minChildSize: 0.45,
              maxChildSize: 0.95,
              builder: (_, scrollController) => PlanningConvocationSheet(
                clubId: clubId,
                event: event,
                scrollController: scrollController,
              ),
            ),
          );
        },
      ),
    );
    return saved == true;
  }

  @override
  ConsumerState<PlanningConvocationSheet> createState() =>
      _PlanningConvocationSheetState();
}

class _PlanningConvocationSheetState
    extends ConsumerState<PlanningConvocationSheet> {
  /// Convoqués d'origine (ids joueurs), figés à la première lecture.
  Set<String>? _initialConvoked;
  final Set<String> _convoked = {};
  bool _saving = false;

  void _seed(List<({String id, ClubMember member})> players) {
    if (_initialConvoked != null) return;
    final convoked = {
      for (final entry in players)
        if (isConvokedOnEvent(widget.event, entry.member)) entry.id,
    };
    _initialConvoked = convoked;
    _convoked.addAll(convoked);
  }

  Future<void> _save() async {
    final initial = _initialConvoked;
    if (initial == null || _saving) return;
    final excludeIds = initial.difference(_convoked).toList();
    final reintegrateIds = _convoked.difference(initial).toList();
    if (excludeIds.isEmpty && reintegrateIds.isEmpty) {
      Navigator.pop(context, false);
      return;
    }

    var scope = _ConvocationScope.single;
    if (widget.event.isRecurringSeries) {
      final picked = await _askScope();
      if (picked == null || !mounted) return;
      scope = picked;
    }

    setState(() => _saving = true);
    try {
      final count = await ref.read(eventServiceProvider).updateConvocations(
            clubId: widget.clubId,
            eventId: widget.event.id,
            excludeIds: excludeIds,
            reintegrateIds: reintegrateIds,
            following: scope == _ConvocationScope.following,
          );
      if (!mounted) return;
      Navigator.pop(context, true);
      ViroSnackBar.show(context, AppCopy.planning.convocationsSaved(count));
    } catch (_) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.planning.convocationsSaveFailed);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<_ConvocationScope?> _askScope() {
    return showDialog<_ConvocationScope>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppCopy.planning.convocationScopeTitle),
        content: Text(AppCopy.planning.convocationScopeBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(AppCopy.common.back),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, _ConvocationScope.single),
            child: Text(AppCopy.planning.thisSessionOnly),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, _ConvocationScope.following),
            child: Text(AppCopy.planning.thisAndFollowing),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final membersAsync = ref.watch(clubMembersProvider(widget.clubId));
    final teams = ref.watch(clubTeamsProvider(widget.clubId)).value;

    return membersAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => const ViroErrorState(),
      data: (members) {
        if (teams == null) {
          return const Center(child: CircularProgressIndicator());
        }
        final eventTeamIds = widget.event.teamIds.toSet();
        final players = teamPlayerEntries(
          teams.where((team) => eventTeamIds.contains(team.id)).toList(),
          indexClubMembersByUid(members),
        );
        _seed(players);

        return Column(
          children: [
            const SizedBox(height: ViroSpacing.sm),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: palette.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Expanded(
              child: ListView(
                controller: widget.scrollController,
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.screenHorizontal,
                  ViroSpacing.md,
                  ViroSpacing.screenHorizontal,
                  ViroSpacing.xl,
                ),
                children: [
                  Text(
                    AppCopy.planning.manageConvocations,
                    style: theme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: palette.brandText,
                    ),
                  ),
                  const SizedBox(height: ViroSpacing.xs),
                  Text(
                    AppCopy.planning.manageConvocationsSubtitle,
                    style: theme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                  if (players.isNotEmpty) ...[
                    const SizedBox(height: ViroSpacing.xs),
                    Text(
                      AppCopy.planning.convocationCount(
                        _convoked.length,
                        players.length,
                      ),
                      style: theme.labelMedium?.copyWith(
                        color: palette.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  const SizedBox(height: ViroSpacing.sm),
                  if (players.isEmpty)
                    Padding(
                      padding:
                          const EdgeInsets.symmetric(vertical: ViroSpacing.lg),
                      child: Text(
                        AppCopy.planning.teamNoPlayers,
                        style: theme.bodyMedium?.copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                    )
                  else
                    for (final entry in players)
                      ConvocationPlayerListTile(
                        key: ValueKey(entry.id),
                        member: entry.member,
                        convoked: _convoked.contains(entry.id),
                        enabled: !_saving,
                        onChanged: (convoked) => setState(() {
                          if (convoked) {
                            _convoked.add(entry.id);
                          } else {
                            _convoked.remove(entry.id);
                          }
                        }),
                      ),
                  const SizedBox(height: ViroSpacing.lg),
                  ViroPrimaryButton(
                    label: _saving
                        ? AppCopy.common.loading
                        : AppCopy.common.save,
                    isLoading: _saving,
                    onPressed: _saving ? null : _save,
                  ),
                  SizedBox(height: MediaQuery.paddingOf(context).bottom),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
