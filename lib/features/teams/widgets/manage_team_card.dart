import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/members/widgets/member_detail_sheet.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/features/teams/widgets/add_team_member_sheet.dart';
import 'package:viro_team_v2/features/teams/widgets/confirm_remove_from_team_dialog.dart';
import 'package:viro_team_v2/features/teams/widgets/invite_team_sheet.dart';
import 'package:viro_team_v2/features/teams/widgets/team_card_header.dart';
import 'package:viro_team_v2/features/teams/widgets/team_federation_section.dart';
import 'package:viro_team_v2/features/teams/widgets/team_quick_actions.dart';
import 'package:viro_team_v2/features/teams/widgets/team_roster_section.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/sport_emoji.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/lists/member_list_tile.dart';
import 'package:viro_team_v2/features/club/providers/club_access_providers.dart';
import 'package:viro_team_v2/models/club_permission.dart';

class ManageTeamCard extends ConsumerStatefulWidget {
  const ManageTeamCard({
    super.key,
    required this.team,
    required this.club,
    required this.accent,
  });

  final ClubTeam team;
  final Club club;
  final Color accent;

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

  /// Ouvre la fiche membre si le compte est lié ; sinon `null` (pas de tap).
  VoidCallback? _memberProfileTap(ClubMember member) {
    if (!member.hasLinkedAccount) return null;
    return () => showMemberDetailSheet(
          context,
          ref: ref,
          club: widget.club,
          member: member,
          accentColor: widget.accent,
        );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final team = widget.team;
    // Droit équipes : tout l'effectif ; coach de l'équipe : ajout de joueurs
    // et code d'invitation selon les réglages coach du club.
    final access = ref.watch(clubAccessProvider(team.clubId));
    final canManageTeams = access.can(ClubPermission.manageTeams);
    final canAddPlayer = access.canAddPlayerToTeam(team.id);
    final canAddCoach = canManageTeams;
    final canRemovePlayer = canManageTeams;
    final canRemoveCoach = canManageTeams;
    final canRemovePending = canManageTeams;
    final canShareTeamInvite = access.canShareTeamInvite(team.id);
    // Calendrier FFVB : volley seulement (une équipe déjà liée garde son bloc
    // pour pouvoir être déliée si le sport du club a changé).
    final canManageFederation =
        (canManageTeams || access.coachesTeam(team.id)) &&
            (isVolleyballSport(widget.club.sport) || team.federation != null);

    final membersAsync = ref.watch(clubMembersProvider(team.clubId));
    final membersByUid = membersAsync.value != null
        ? indexClubMembersById(membersAsync.value!)
        : <String, ClubMember>{};
    final sessionMemberId =
        ref.watch(rosterSessionMemberIdProvider(team.clubId));
    final orderedCoachIds = pinSessionMemberIdFirst(
      team.coachIds,
      sessionMemberId: sessionMemberId,
    );
    final orderedPlayerIds = pinSessionMemberIdFirst(
      team.playerIds,
      sessionMemberId: sessionMemberId,
    );

    /// Ligne de roster d'un membre connu ; `null` si la fiche est introuvable.
    MemberListTile? rosterTile(
      String uid, {
      required ViroRole role,
      required void Function(String uid, ClubMember member)? onRemove,
    }) {
      final member = membersByUid[uid];
      if (member == null) return null;
      return MemberListTile(
        member: member,
        club: widget.club,
        accentColor: widget.accent,
        showClubAdminActions: false,
        embedded: true,
        displayRole: role,
        isSessionMember: member.memberId == sessionMemberId,
        onTap: _memberProfileTap(member),
        onRemove: onRemove == null ? null : () => onRemove(uid, member),
      );
    }

    return ViroCard(
      accentColor: widget.accent,
      borderColor: ClubAccentStyle(widget.accent).border,
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
              shape: const Border(),
              collapsedShape: const Border(),
              iconColor: palette.textSecondary,
              collapsedIconColor: palette.textSecondary,
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
              title: TeamCardHeader(
                team: team,
                club: widget.club,
                accent: widget.accent,
              ),
              children: [
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
                  TeamQuickActions(
                    team: team,
                    accent: widget.accent,
                    onInvite: canShareTeamInvite && !_busy
                        ? () => showInviteTeamSheet(
                              context,
                              club: widget.club,
                              team: team,
                            )
                        : null,
                  ),
                  if (canManageFederation)
                    TeamFederationSection(team: team, accent: widget.accent),
                  TeamRosterSection(
                    title: AppCopy.teams.coachesSection,
                    titleColor: ViroColors.coachBadgeEnd,
                    addTooltip: AppCopy.teams.addCoachTitle,
                    onAdd: canAddCoach && !_busy
                        ? () => _openAddSheet(TeamRosterSlot.coach)
                        : null,
                    children: [
                      for (final uid in orderedCoachIds)
                        ?rosterTile(
                          uid,
                          role: ViroRole.coach,
                          onRemove: canRemoveCoach ? _removeCoach : null,
                        ),
                    ],
                  ),
                  TeamRosterSection(
                    title: AppCopy.teams.playersSection,
                    titleColor: widget.accent,
                    addTooltip: AppCopy.teams.addPlayerTitle,
                    onAdd: canAddPlayer && !_busy
                        ? () => _openAddSheet(TeamRosterSlot.player)
                        : null,
                    children: [
                      for (final uid in orderedPlayerIds)
                        ?rosterTile(
                          uid,
                          role: ViroRole.player,
                          onRemove: canRemovePlayer ? _removePlayer : null,
                        ),
                    ],
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
                    else
                      TeamRosterSection(
                        title: AppCopy.teams.pendingSection,
                        titleColor: palette.textSecondary,
                        showWhenEmpty: false,
                        children: [
                          for (final pending in _pending ?? <PendingTeamMember>[])
                            MemberListTile(
                              member: pendingAsClubMember(pending),
                              club: widget.club,
                              accentColor: widget.accent,
                              showClubAdminActions: false,
                              embedded: true,
                              displayRole: ViroRole.player,
                              onRemove: canRemovePending
                                  ? () => _removePending(pending)
                                  : null,
                            ),
                        ],
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
