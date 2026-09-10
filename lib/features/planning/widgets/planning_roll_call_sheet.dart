import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';

/// Sheet coach : pointer Présent / Absent sans modifier le RSVP.
class PlanningRollCallSheet extends ConsumerStatefulWidget {
  const PlanningRollCallSheet({
    super.key,
    required this.clubId,
    required this.event,
    required this.scrollController,
    this.excludeCoachUids = const {},
  });

  final String clubId;
  final ClubEvent event;
  final ScrollController scrollController;
  final Set<String> excludeCoachUids;

  /// Ouvre la sheet d'appel. Retourne `true` si l'appel a été enregistré.
  static Future<bool> show({
    required BuildContext context,
    required WidgetRef ref,
    required String clubId,
    required ClubEvent event,
    Set<String> excludeCoachUids = const {},
  }) async {
    final accent = ref.read(clubMemberAccentProvider(clubId));
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => ClubAccentTheme(
        accentColor: accent,
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.75,
          minChildSize: 0.45,
          maxChildSize: 0.95,
          builder: (_, scrollController) => PlanningRollCallSheet(
            clubId: clubId,
            event: event,
            scrollController: scrollController,
            excludeCoachUids: excludeCoachUids,
          ),
        ),
      ),
    );
    return saved == true;
  }

  @override
  ConsumerState<PlanningRollCallSheet> createState() =>
      _PlanningRollCallSheetState();
}

class _PlanningRollCallSheetState extends ConsumerState<PlanningRollCallSheet> {
  final Map<String, AttendanceStatus> _draft = {};
  bool _saving = false;
  bool _seeded = false;

  void _seedFromEvent(List<String> memberIds) {
    if (_seeded) return;
    _seeded = true;
    for (final id in memberIds) {
      final existing = widget.event.attendanceStatusFor(id);
      if (existing != null) {
        _draft[id] = existing;
        continue;
      }
      final rsvp = widget.event.rsvpFor(id);
      if (rsvp == RsvpStatus.yes) {
        _draft[id] = AttendanceStatus.present;
      } else if (rsvp == RsvpStatus.no) {
        _draft[id] = AttendanceStatus.absent;
      }
    }
  }

  Future<void> _save() async {
    final uid = ref.read(authStateProvider).value?.uid;
    if (uid == null || _draft.isEmpty || _saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(eventServiceProvider).updateAttendance(
            clubId: widget.clubId,
            eventId: widget.event.id,
            statusesByMemberId: Map<String, AttendanceStatus>.from(_draft),
            markedByUid: uid,
          );
      if (!mounted) return;
      Navigator.pop(context, true);
      ViroSnackBar.show(context, AppCopy.planning.attendanceSaved);
    } catch (_) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.planning.attendanceSaveFailed);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    final membersAsync = ref.watch(clubMembersProvider(widget.clubId));

    return membersAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => const ViroErrorState(),
      data: (members) {
        final byUid = indexClubMembersByUid(members);
        final playerIds =
            widget.event.playerMemberIds(widget.excludeCoachUids);
        _seedFromEvent(playerIds);

        final entries = <({String id, ClubMember member})>[];
        for (final id in playerIds) {
          final member = byUid[id];
          if (member == null) continue;
          entries.add((id: id, member: member));
        }
        entries.sort((a, b) {
          final an = a.member.fullName.toLowerCase();
          final bn = b.member.fullName.toLowerCase();
          return an.compareTo(bn);
        });

        return Column(
          children: [
            const SizedBox(height: ViroSpacing.sm),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: ViroColors.gray200,
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
                    AppCopy.planning.takeAttendanceTitle,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: ViroSpacing.xs),
                  Text(
                    AppCopy.planning.takeAttendanceSubtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: ViroColors.gray600,
                        ),
                  ),
                  const SizedBox(height: ViroSpacing.md),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: _saving || entries.isEmpty
                          ? null
                          : () => setState(() {
                                for (final e in entries) {
                                  _draft[e.id] = AttendanceStatus.present;
                                }
                              }),
                      icon: ViroIcon(ViroIcons.check, size: 18),
                      label: Text(AppCopy.planning.markAllPresent),
                    ),
                  ),
                  const SizedBox(height: ViroSpacing.sm),
                  if (entries.isEmpty)
                    Padding(
                      padding:
                          const EdgeInsets.symmetric(vertical: ViroSpacing.lg),
                      child: Text(
                        AppCopy.planning.noMembersCalled,
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: ViroColors.gray600),
                      ),
                    )
                  else
                    for (final entry in entries)
                      _RollCallRow(
                        member: entry.member,
                        status: _draft[entry.id],
                        accent: accent,
                        enabled: !_saving,
                        onChanged: (status) =>
                            setState(() => _draft[entry.id] = status),
                      ),
                  const SizedBox(height: ViroSpacing.lg),
                  ViroPrimaryButton(
                    label: _saving
                        ? AppCopy.common.loading
                        : AppCopy.common.save,
                    isLoading: _saving,
                    onPressed: _saving || _draft.isEmpty ? null : _save,
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

class _RollCallRow extends StatelessWidget {
  const _RollCallRow({
    required this.member,
    required this.status,
    required this.accent,
    required this.enabled,
    required this.onChanged,
  });

  final ClubMember member;
  final AttendanceStatus? status;
  final Color accent;
  final bool enabled;
  final ValueChanged<AttendanceStatus> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: Row(
        children: [
          MemberAvatar(member: member, size: 36),
          const SizedBox(width: ViroSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  member.fullName.isNotEmpty
                      ? member.fullName
                      : AppCopy.planning.unnamedMember,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                if (status == null)
                  Text(
                    AppCopy.planning.attendanceUnmarked,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: ViroColors.gray600,
                        ),
                  ),
              ],
            ),
          ),
          SegmentedButton<AttendanceStatus>(
            style: SegmentedButton.styleFrom(
              selectedBackgroundColor: accent,
              selectedForegroundColor: ViroColors.white,
            ),
            segments: [
              ButtonSegment(
                value: AttendanceStatus.present,
                label: Text(AppCopy.planning.attendancePresent),
              ),
              ButtonSegment(
                value: AttendanceStatus.absent,
                label: Text(AppCopy.planning.attendanceAbsent),
              ),
            ],
            emptySelectionAllowed: true,
            selected: status == null ? {} : {status!},
            onSelectionChanged: !enabled
                ? null
                : (selected) {
                    if (selected.isEmpty) return;
                    onChanged(selected.first);
                  },
          ),
        ],
      ),
    );
  }
}
