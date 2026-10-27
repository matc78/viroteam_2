import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/feature_flags.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_manage_permissions.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/features/teams/widgets/add_team_member_sheet.dart';
import 'package:viro_team_v2/features/teams/widgets/confirm_remove_from_team_dialog.dart';
import 'package:viro_team_v2/features/teams/widgets/invite_team_sheet.dart';
import 'package:viro_team_v2/features/teams/widgets/team_messaging_links_section.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/lists/member_list_tile.dart';

class ManageTeamCard extends ConsumerStatefulWidget {
  const ManageTeamCard({
    super.key,
    required this.team,
    required this.club,
    required this.accent,
    required this.permissions,
    required this.viewerRole,
  });

  final ClubTeam team;
  final Club club;
  final Color accent;
  final TeamManagePermissions permissions;
  final String viewerRole;

  @override
  ConsumerState<ManageTeamCard> createState() => _ManageTeamCardState();
}

class _ManageTeamCardState extends ConsumerState<ManageTeamCard> {
  List<PendingTeamMember>? _pending;
  bool _loadingPending = false;
  bool _expanded = false;
  bool _busy = false;

  Future<void> _loadPending() async {
    if (_pending != null || widget.team.pendingPlayerIds.isEmpty) return;
    setState(() => _loadingPending = true);

    final pending = await ref.read(teamServiceProvider).fetchPendingMembers(
          clubId: widget.team.clubId,
          pendingIds: widget.team.pendingPlayerIds,
        );

    if (!mounted) return;
    setState(() {
      _pending = pending;
      _loadingPending = false;
    });
  }

  /// Exécute [action] sous overlay de chargement ; [successMessage] est
  /// affiché en snackbar si l’action réussit.
  Future<void> _run(
    Future<void> Function() action, {
    String? successMessage,
  }) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      if (mounted && successMessage != null) {
        ViroSnackBar.show(context, successMessage);
      }
    } catch (e) {
      if (mounted) {
        ViroSnackBar.show(context, AppCopy.common.errorWithDetails(e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final team = widget.team;
    final perms = widget.permissions;
    final canAddPlayer = perms.canAddPlayer(team);
    final canAddCoach = perms.canAddCoach(team);
    final canRemovePlayer = perms.canRemovePlayer(team);
    final canRemoveCoach = perms.canRemoveCoach(team);
    final canRemovePending = perms.canRemovePendingPlayer(team);
    final canShareTeamInvite = perms.canShareTeamInvite(team);

    final membersAsync = ref.watch(clubMembersProvider(team.clubId));
    final membersByUid = membersAsync.value != null
        ? indexClubMembersByUid(membersAsync.value!)
        : <String, ClubMember>{};

    return ViroCard(
      accentColor: widget.accent,
      borderColor: widget.accent.withValues(alpha: 0.35),
      margin: const EdgeInsets.only(bottom: ViroSpacing.sm),
      padding: EdgeInsets.zero,
      child: Stack(
        children: [
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              onExpansionChanged: (expanded) {
                setState(() => _expanded = expanded);
                if (expanded) _loadPending();
              },
              tilePadding: const EdgeInsets.symmetric(
                horizontal: ViroSpacing.md,
                vertical: ViroSpacing.xs,
              ),
              childrenPadding: const EdgeInsets.fromLTRB(
                ViroSpacing.md,
                0,
                ViroSpacing.md,
                ViroSpacing.md,
              ),
              title: Text(
                team.name,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: palette.readableAccent(widget.accent),
                    ),
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    team.categoryLabel,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                  ),
                  if (!_expanded)
                    Text(
                      AppCopy.teams.rosterSummary(
                        players: team.playerIds.length,
                        coaches: team.coachIds.length,
                        pending: team.pendingPlayerIds.length,
                      ),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: palette.textMuted,
                          ),
                    ),
                ],
              ),
              children: [
                const Divider(height: 1),
                if (!_expanded)
                  const SizedBox.shrink()
                else if (membersAsync.isLoading)
                  const Padding(
                    padding: EdgeInsets.all(ViroSpacing.lg),
                    child: Center(
                      child: SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                  )
                else ...[
                  // Messagerie cachée en release tant que la feature n’est pas live.
                  if (FeatureFlags.chatMessagingLive)
                    TeamMessagingLinksSection(
                      team: team,
                      accent: widget.accent,
                    ),
                  if (canShareTeamInvite) ...[
                    const SizedBox(height: ViroSpacing.sm),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: _busy
                            ? null
                            : () => showInviteTeamSheet(
                                  context,
                                  club: widget.club,
                                  team: team,
                                ),
                        icon: ViroIcon(ViroIcons.users, size: 18),
                        label: Text(AppCopy.join.inviteTeamTitle),
                      ),
                    ),
                  ],
                  _buildRosterSection(
                    title: AppCopy.teams.coachesSection,
                    titleColor: ViroColors.coachBadgeEnd,
                    addLabel: AppCopy.teams.addCoachTitle,
                    canAdd: canAddCoach,
                    onAdd: canAddCoach
                        ? () => _openAddSheet(TeamRosterSlot.coach)
                        : null,
                    children: team.coachIds.map((uid) {
                      final member = clubMemberForTeamUid(membersByUid, uid);
                      if (member == null) return const SizedBox.shrink();
                      return MemberListTile(
                        member: member,
                        club: widget.club,
                        viewerRole: widget.viewerRole,
                        accentColor: widget.accent,
                        showClubAdminActions: false,
                        onRemove: canRemoveCoach
                            ? () => _removeCoach(uid, member)
                            : null,
                      );
                    }),
                  ),
                  _buildRosterSection(
                    title: AppCopy.teams.playersSection,
                    titleColor: widget.accent,
                    addLabel: AppCopy.teams.addPlayerTitle,
                    canAdd: canAddPlayer,
                    onAdd: canAddPlayer
                        ? () => _openAddSheet(TeamRosterSlot.player)
                        : null,
                    children: team.playerIds.map((uid) {
                      final member = clubMemberForTeamUid(membersByUid, uid);
                      if (member == null) return const SizedBox.shrink();
                      return MemberListTile(
                        member: member,
                        club: widget.club,
                        viewerRole: widget.viewerRole,
                        accentColor: widget.accent,
                        showClubAdminActions: false,
                        onRemove: canRemovePlayer
                            ? () => _removePlayer(uid, member)
                            : null,
                      );
                    }),
                  ),
                  if (team.pendingPlayerIds.isNotEmpty) ...[
                    if (_loadingPending)
                      const Padding(
                        padding: EdgeInsets.all(ViroSpacing.md),
                        child: Center(
                          child: SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                      )
                    else if (_pending != null && _pending!.isNotEmpty)
                      _buildRosterSection(
                        title: AppCopy.teams.pendingSection,
                        titleColor: palette.textSecondary,
                        canAdd: false,
                        children: _pending!.map(
                          (p) => MemberListTile(
                            member: pendingAsClubMember(p),
                            club: widget.club,
                            viewerRole: widget.viewerRole,
                            accentColor: widget.accent,
                            showClubAdminActions: false,
                            onRemove: canRemovePending
                                ? () => _removePending(p)
                                : null,
                          ),
                        ),
                      ),
                  ],
                ],
              ],
            ),
          ),
          if (_busy)
            Positioned.fill(
              child: Container(
                color: palette.background.withValues(alpha: 0.6),
                child: const Center(
                  child: SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRosterSection({
    required String title,
    required Color titleColor,
    required Iterable<Widget> children,
    String? addLabel,
    bool canAdd = false,
    VoidCallback? onAdd,
  }) {
    final palette = context.viroPalette;
    final childList = children.toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: ViroSpacing.sm, bottom: 4),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  title.toUpperCase(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.readableAccent(titleColor),
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1,
                      ),
                ),
              ),
              if (canAdd && onAdd != null)
                TextButton.icon(
                  onPressed: _busy ? null : onAdd,
                  icon: ViroIcon(ViroIcons.add, size: 18),
                  label: Text(addLabel ?? AppCopy.common.add),
                ),
            ],
          ),
        ),
        if (childList.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
            child: Text(
              AppCopy.teams.noMembers,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: palette.textSecondary,
                  ),
            ),
          )
        else
          ...childList,
      ],
    );
  }

  void _openAddSheet(TeamRosterSlot slot) {
    final service = ref.read(teamServiceProvider);
    final team = widget.team;

    showAddTeamMemberSheet(
      context: context,
      ref: ref,
      clubId: team.clubId,
      team: team,
      slot: slot,
      onAdd: (id) => _run(() async {
        if (slot == TeamRosterSlot.coach) {
          await service.addCoachToTeam(
            clubId: team.clubId,
            teamId: team.id,
            uid: id,
          );
          return;
        }

        final pendingIds = ref
                .read(pendingTeamMembersProvider(team.clubId))
                .value
                ?.map((p) => p.id)
                .toSet() ??
            {};
        if (pendingIds.contains(id)) {
          await service.addPendingPlayerToTeam(
            clubId: team.clubId,
            teamId: team.id,
            pendingId: id,
          );
        } else {
          // Sync convocations gérée dans [TeamService.addPlayerToTeam].
          await service.addPlayerToTeam(
            clubId: team.clubId,
            teamId: team.id,
            uid: id,
          );
        }
      }),
    );
  }

  /// Nom affiché dans la confirmation et le snackbar de retrait.
  String _displayName(String fullName) {
    final trimmed = fullName.trim();
    return trimmed.isNotEmpty ? trimmed : AppCopy.members.unnamed;
  }

  /// Demande confirmation (nom du membre + de l’équipe) avant un retrait.
  Future<bool> _confirmRemoval(String memberName) {
    if (_busy) return Future.value(false);
    return showConfirmRemoveFromTeamDialog(
      context,
      memberName: memberName,
      teamName: widget.team.name,
    );
  }

  String _removedMessage(String memberName) => AppCopy.teams.removedFromTeam(
        memberName: memberName,
        teamName: widget.team.name,
      );

  Future<void> _removePlayer(String uid, ClubMember member) async {
    final name = _displayName(member.fullName);
    if (!await _confirmRemoval(name)) return;
    await _run(
      () {
        // Sync convocations / RSVP gérée dans [TeamService.removePlayerFromTeam].
        return ref.read(teamServiceProvider).removePlayerFromTeam(
              clubId: widget.team.clubId,
              teamId: widget.team.id,
              uid: uid,
            );
      },
      successMessage: _removedMessage(name),
    );
  }

  Future<void> _removeCoach(String uid, ClubMember member) async {
    final name = _displayName(member.fullName);
    if (!await _confirmRemoval(name)) return;
    await _run(
      () => ref.read(teamServiceProvider).removeCoachFromTeam(
            clubId: widget.team.clubId,
            teamId: widget.team.id,
            uid: uid,
          ),
      successMessage: _removedMessage(name),
    );
  }

  Future<void> _removePending(PendingTeamMember pending) async {
    final name = _displayName(pending.fullName);
    if (!await _confirmRemoval(name)) return;
    await _run(
      () async {
        await ref.read(teamServiceProvider).removePendingPlayerFromTeam(
              clubId: widget.team.clubId,
              teamId: widget.team.id,
              pendingId: pending.id,
            );
        // Liste en attente chargée une fois : on retire la ligne localement.
        if (mounted) {
          setState(() {
            _pending =
                _pending?.where((p) => p.id != pending.id).toList();
          });
        }
      },
      successMessage: _removedMessage(name),
    );
  }
}
