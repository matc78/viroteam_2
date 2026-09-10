import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/members/utils/parent_status_for_member.dart';
import 'package:viro_team_v2/features/members/utils/member_invite_feedback.dart';
import 'package:viro_team_v2/features/members/widgets/add_member_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/change_role_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/invite_parent_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/member_bulk_action_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/member_invite_progress_overlay.dart';
import 'package:viro_team_v2/features/members/widgets/member_list_tile.dart';
import 'package:viro_team_v2/services/member_invite_service.dart';
import 'package:viro_team_v2/features/members/widgets/member_detail_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/pending_member_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/parents_section.dart';
import 'package:viro_team_v2/features/teams/providers/team_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_manage_permissions.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_floating_icon_button.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_primary_button.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';
import 'package:viro_team_v2/widgets/common/viro_status_toast.dart';

class ClubMembersScreen extends ConsumerStatefulWidget {
  const ClubMembersScreen({super.key, required this.clubId});

  final String clubId;

  @override
  ConsumerState<ClubMembersScreen> createState() => _ClubMembersScreenState();
}

class _ClubMembersScreenState extends ConsumerState<ClubMembersScreen> {
  final _searchController = TextEditingController();
  String _search = '';
  String? _roleFilter;

  /// `roster` | `teams` | `parents`
  String _section = 'roster';
  bool _selectionMode = false;
  final _selectedMemberIds = <String>{};
  bool _inviteAllBusy = false;
  int _inviteProgressDone = 0;
  int _inviteProgressTotal = 0;
  String? _inviteProgressName;
  String _inviteProgressPhase = AppCopy.members.inviteSendingPhase;
  Timer? _bulkInviteCooldownTicker;

  /// Cooldown du bouton « Inviter les non inscrits » (tous).
  static const _bulkInviteCooldown = Duration(hours: 1);

  Future<void> _openManageTeams() async {
    await context.push(AppRoutes.clubManageTeamsPath(widget.clubId));
  }

  @override
  void dispose() {
    _bulkInviteCooldownTicker?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  /// Démarre / arrête le ticker qui rafraîchit le libellé du cooldown.
  void _syncBulkInviteCooldownTicker(DateTime? lastSentAt) {
    final remaining = _bulkInviteCooldownRemaining(lastSentAt);
    if (remaining == null) {
      _bulkInviteCooldownTicker?.cancel();
      _bulkInviteCooldownTicker = null;
      return;
    }
    if (_bulkInviteCooldownTicker?.isActive == true) return;
    _bulkInviteCooldownTicker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final club = ref.read(clubForMembersProvider(widget.clubId)).value;
      final stillRemaining =
          _bulkInviteCooldownRemaining(club?.lastBulkMemberInviteAt);
      if (stillRemaining == null) {
        _bulkInviteCooldownTicker?.cancel();
        _bulkInviteCooldownTicker = null;
      }
      setState(() {});
    });
  }

  bool get _canAdd {
    final member = ref.read(clubMemberProvider(widget.clubId)).value;
    if (member == null) return false;
    final club = ref.read(clubForMembersProvider(widget.clubId)).value;
    return (club?.coachPermissions ?? CoachPermissions.defaults)
        .allowsInvitePlayers(
      isAdmin: member.role == MemberRoles.admin,
      isCoach: member.role == MemberRoles.coach,
    );
  }

  bool get _isAdmin {
    final member = ref.read(clubMemberProvider(widget.clubId)).value;
    return member?.role == MemberRoles.admin;
  }

  /// Admin ou coach autorisé à gérer le roster d’équipe.
  bool get _canManageRoster {
    final member = ref.read(clubMemberProvider(widget.clubId)).value;
    if (member == null) return false;
    final club = ref.read(clubForMembersProvider(widget.clubId)).value;
    return (club?.coachPermissions ?? CoachPermissions.defaults)
        .allowsManageTeamRoster(
      isAdmin: member.role == MemberRoles.admin,
      isCoach: member.role == MemberRoles.coach,
    );
  }

  /// Sélection multiple : invitations et/ou ajout à une équipe.
  bool get _canSelectMembers => _isAdmin || _canAdd || _canManageRoster;

  /// Bouton « Inviter les non inscrits » (tous) réservé aux admins.
  bool get _canInviteAll => _isAdmin;

  /// Membres non inscrits avec e-mail (éligibles à l’envoi d’invitation).
  List<ClubMember> _eligibleInviteMembers(List<ClubMember> members) {
    return members.where((member) => member.canReceiveInviteEmail).toList();
  }

  /// Temps restant avant de pouvoir renvoyer à tous (null = autorisé).
  Duration? _bulkInviteCooldownRemaining(DateTime? lastSentAt) {
    if (lastSentAt == null) return null;
    final elapsed = DateTime.now().difference(lastSentAt);
    if (elapsed >= _bulkInviteCooldown) return null;
    return _bulkInviteCooldown - elapsed;
  }

  String _formatCooldown(Duration remaining) {
    final hours = remaining.inHours;
    final minutes = remaining.inMinutes.remainder(60);
    final seconds = remaining.inSeconds.remainder(60);
    if (hours > 0) {
      return '${hours}h${minutes.toString().padLeft(2, '0')} '
          '${seconds.toString().padLeft(2, '0')}s';
    }
    if (minutes > 0) {
      return '$minutes min ${seconds.toString().padLeft(2, '0')}s';
    }
    return '${seconds}s';
  }

  List<ClubMember> _filterMembers(List<ClubMember> members) {
    return members.where((m) {
      if (_roleFilter != null && m.role != _roleFilter) return false;
      if (_search.isEmpty) return true;
      return m.fullName.toLowerCase().contains(_search.toLowerCase());
    }).toList();
  }

  Widget _roleFilterChip({
    required String label,
    required bool selected,
    required ValueChanged<bool> onSelected,
    Color? accentColor,
  }) {
    final accent = accentColor ?? ViroColors.primary600;
    return FilterChip(
      label: Text(
        label,
        style: TextStyle(
          color: selected ? ViroColors.white : accent,
          fontWeight: FontWeight.w600,
        ),
      ),
      selected: selected,
      onSelected: onSelected,
      showCheckmark: false,
      selectedColor: accent,
      backgroundColor: ViroColors.gray50,
      side: BorderSide(
        color: selected ? accent : ViroColors.gray200,
      ),
    );
  }

  Future<void> _addMember() async {
    final club = ref.read(clubForMembersProvider(widget.clubId)).value;
    if (club == null || !mounted) return;
    await showAddMemberSheet(context, club: club);
  }

  Future<bool> _emailInvite(ClubMember member) async {
    try {
      final auth = ref.read(authStateProvider).value;
      final club = ref.read(clubForMembersProvider(widget.clubId)).value;
      if (auth == null || club == null) {
        throw StateError('Session ou club indisponible.');
      }
      await ref.read(memberServiceProvider).ensureMemberInvitation(
            clubId: widget.clubId,
            club: club,
            member: member,
            sentByUid: auth.uid,
            email: member.email ?? '',
          );
      final result =
          await ref.read(memberInviteServiceProvider).sendMemberInvites(
        clubId: widget.clubId,
        memberIds: [member.memberId],
      );
      if (result.sent > 0) {
        if (mounted) {
          showInviteSendFeedback(
            context,
            result: result,
            members: [member],
          );
        }
        return true;
      }
      final first = result.results.isNotEmpty ? result.results.first : null;
      throw Exception(
        first?.reason ?? AppCopy.members.inviteSendFailed,
      );
    } catch (error) {
      if (mounted) {
        ViroSnackBar.show(
          context,
          callableErrorMessage(
            error,
            fallback: AppCopy.members.inviteSendImpossibleSingular,
          ),
        );
      }
      return false;
    }
  }

  Future<void> _changeRole(ClubMember member) async {
    final accent = ref.read(clubMemberAccentProvider(widget.clubId));
    final newRole = await showChangeRoleSheet(
      context,
      member: member,
      accentColor: accent,
    );
    if (newRole == null || newRole == member.role) return;

    try {
      await ref.read(memberServiceProvider).updateMemberRole(
            clubId: widget.clubId,
            memberId: member.memberId,
            newRole: newRole,
          );
    } catch (error) {
      if (!mounted) return;
      ViroSnackBar.show(
        context,
        callableErrorMessage(error, fallback: AppCopy.members.roleChangeImpossible),
      );
    }
  }

  Future<void> _removeMember(ClubMember member) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Theme(
        data: Theme.of(context),
        child: AlertDialog(
          title: Text(AppCopy.members.deleteMemberTitle),
          content: Text(
            AppCopy.members.deleteMemberBody(member.fullName),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(AppCopy.common.cancel),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(
                AppCopy.common.delete,
                style: TextStyle(color: ViroColors.error),
              ),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true) return;

    try {
      await ref.read(memberServiceProvider).removeMember(
            clubId: widget.clubId,
            memberId: member.memberId,
          );
    } catch (error) {
      if (!mounted) return;
      ViroSnackBar.show(
        context,
        callableErrorMessage(error,
            fallback: AppCopy.members.removeMemberImpossible),
      );
    }
  }

  void _enterSelectionMode(ClubMember member) {
    if (!_canSelectMembers) return;
    setState(() {
      _selectionMode = true;
      _selectedMemberIds.add(member.memberId);
    });
  }

  void _toggleMemberSelection(ClubMember member) {
    if (!_selectionMode) return;
    setState(() {
      if (_selectedMemberIds.contains(member.memberId)) {
        _selectedMemberIds.remove(member.memberId);
      } else {
        _selectedMemberIds.add(member.memberId);
      }
      if (_selectedMemberIds.isEmpty) {
        _selectionMode = false;
      }
    });
  }

  void _cancelSelectionMode() {
    setState(() {
      _selectionMode = false;
      _selectedMemberIds.clear();
    });
  }

  Future<void> _openBulkActions(List<ClubMember> allMembers) async {
    if (_selectedMemberIds.isEmpty) return;
    final selectedMembers = allMembers
        .where((member) => _selectedMemberIds.contains(member.memberId))
        .toList();
    if (selectedMembers.isEmpty) {
      _cancelSelectionMode();
      return;
    }

    final auth = ref.read(authStateProvider).value;
    final club = ref.read(clubForMembersProvider(widget.clubId)).value;
    final viewer = ref.read(clubMemberProvider(widget.clubId)).value;
    if (auth == null || club == null || viewer == null) return;

    final teams = ref.read(clubTeamsProvider(widget.clubId)).value ?? [];
    final teamPermissions = TeamManagePermissions(
      viewerRole: viewer.role,
      currentUid: auth.uid,
      coachPermissions: club.coachPermissions,
    );
    final addableTeams =
        teams.where(teamPermissions.canAddPlayer).toList(growable: false);

    final acted = await showMemberBulkActionSheet(
      context,
      clubId: widget.clubId,
      club: club,
      sentByUid: auth.uid,
      selectedMembers: selectedMembers,
      memberInviteService: ref.read(memberInviteServiceProvider),
      memberService: ref.read(memberServiceProvider),
      teamService: ref.read(teamServiceProvider),
      addableTeams: addableTeams,
      canSendInvites: _canAdd,
      canAddToTeam: _canManageRoster,
    );
    if (!mounted) return;
    if (acted == true) {
      _cancelSelectionMode();
    }
  }

  /// Envoie un e-mail d’invitation à tous les membres non inscrits éligibles.
  Future<void> _inviteAllPending(List<ClubMember> members) async {
    if (!_canInviteAll) return;
    if (_inviteAllBusy) {
      ViroSnackBar.show(context, AppCopy.members.inviteAlreadyBusy);
      return;
    }

    final clubSnapshot = ref.read(clubForMembersProvider(widget.clubId)).value;
    final cooldown =
        _bulkInviteCooldownRemaining(clubSnapshot?.lastBulkMemberInviteAt);
    if (cooldown != null) {
      ViroSnackBar.show(
        context,
        AppCopy.members.bulkInviteCooldown(_formatCooldown(cooldown)),
      );
      return;
    }

    final eligible = _eligibleInviteMembers(members);
    if (eligible.isEmpty) {
      ViroSnackBar.show(
        context,
        AppCopy.members.noUnregisteredWithEmail,
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Theme(
        data: Theme.of(context),
        child: AlertDialog(
          title: Text(AppCopy.members.inviteAllConfirmTitle),
          content: Text(
            AppCopy.members.inviteAllConfirmBody(eligible.length),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(AppCopy.common.cancel),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(AppCopy.common.send),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      _inviteAllBusy = true;
      _inviteProgressDone = 0;
      _inviteProgressTotal = eligible.length;
      _inviteProgressName = null;
      _inviteProgressPhase = AppCopy.members.preparingCodes;
    });
    try {
      final auth = ref.read(authStateProvider).value;
      final club = ref.read(clubForMembersProvider(widget.clubId)).value;
      if (auth == null || club == null) {
        throw StateError('Session ou club indisponible.');
      }

      await ref.read(memberServiceProvider).ensureMemberInvitations(
            clubId: widget.clubId,
            club: club,
            members: eligible,
            sentByUid: auth.uid,
          );

      if (!mounted) return;
      setState(() => _inviteProgressPhase = AppCopy.members.inviteSendingPhase);

      final inviteService = ref.read(memberInviteServiceProvider);
      final itemResults = <SendMemberInviteItemResult>[];
      var sent = 0;
      var skipped = 0;
      var failed = 0;

      for (var index = 0; index < eligible.length; index++) {
        final member = eligible[index];
        if (!mounted) return;
        setState(() {
          _inviteProgressName = member.fullName.trim().isNotEmpty
              ? member.fullName.trim()
              : AppCopy.members.memberFallback(index + 1);
          _inviteProgressDone = index;
        });

        try {
          final partial = await inviteService.sendMemberInvites(
            clubId: widget.clubId,
            memberIds: [member.memberId],
          );
          itemResults.addAll(partial.results);
          sent += partial.sent;
          skipped += partial.skipped;
          failed += partial.failed;
        } catch (error) {
          failed += 1;
          itemResults.add(
            SendMemberInviteItemResult(
              memberId: member.memberId,
              status: 'failed',
              reason: callableErrorMessage(
                error,
                fallback: AppCopy.members.sendFailedShort,
              ),
            ),
          );
        }

        if (!mounted) return;
        setState(() => _inviteProgressDone = index + 1);
      }

      final result = SendMemberInvitesResult(
        sent: sent,
        skipped: skipped,
        failed: failed,
        results: itemResults,
      );

      if (result.sent > 0) {
        await ref.read(clubServiceProvider).markBulkMemberInviteSent(
              clubId: widget.clubId,
            );
        ref.invalidate(clubForMembersProvider(widget.clubId));
      }

      if (!mounted) return;
      showInviteSendFeedback(context, result: result, members: eligible);
      ref.invalidate(clubMembersWithInvitesProvider(widget.clubId));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).clearSnackBars();
      ViroStatusToast.show(
        context,
        message: callableErrorMessage(
          error,
          fallback: AppCopy.members.inviteSendImpossible,
        ),
        success: false,
        duration: const Duration(seconds: 4),
      );
    } finally {
      _inviteAllBusy = false;
      _inviteProgressDone = 0;
      _inviteProgressTotal = 0;
      _inviteProgressName = null;
      if (mounted) setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final membersAsync = ref.watch(clubMembersWithInvitesProvider(clubId));
    final clubAsync = ref.watch(clubForMembersProvider(clubId));
    // Précharge les équipes pour l’action « Ajouter à une équipe ».
    if (_canManageRoster) {
      ref.watch(clubTeamsProvider(clubId));
    }
    final accent = ref.watch(clubManagementAccentProvider(clubId));
    final memberAccent = ref.watch(clubMemberAccentProvider(clubId));

    return ClubAccentTheme(
      accentColor: memberAccent,
      child: PopScope(
        canPop: !_inviteAllBusy,
        child: Stack(
          children: [
            ViroScaffold(
              appBar: ViroAppBar(
                leading: IconButton(
                  icon: ViroIcon(ViroIcons.chevronLeft),
                  onPressed: _inviteAllBusy ? null : () => context.pop(),
                ),
                title: Text(AppCopy.members.manageTitle),
                actions: [
                  if (_selectionMode && !_inviteAllBusy)
                    TextButton(
                      onPressed: _cancelSelectionMode,
                      child: Text(AppCopy.common.cancel),
                    ),
                  if (_selectionMode &&
                      !_inviteAllBusy &&
                      _selectedMemberIds.isNotEmpty)
                    TextButton(
                      onPressed: membersAsync.value == null
                          ? null
                          : () => _openBulkActions(membersAsync.value!),
                      child: Text(AppCopy.members.actions),
                    ),
                ],
              ),
              floatingActionButton:
                  _canAdd && _section == 'roster' && !_inviteAllBusy
                      ? ViroFloatingActionButton(
                          icon: ViroIcons.add,
                          onPressed: _addMember,
                        )
                      : null,
              body: clubAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, stackTrace) => const ViroErrorState(),
                data: (club) {
                  if (club == null) {
                    return Center(child: Text(AppCopy.members.clubNotFound));
                  }

                  return membersAsync.when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (error, stackTrace) => const ViroErrorState(),
                    data: (members) {
                      final viewerRole =
                          ref.watch(clubMemberProvider(clubId)).value?.role ??
                              MemberRoles.player;
                      final filtered = _filterMembers(members);
                      final eligibleInviteCount =
                          _eligibleInviteMembers(members).length;
                      final parentStatusByMemberId = _isAdmin
                          ? ref.watch(clubParentsProvider(clubId)).maybeWhen(
                                data: buildParentStatusByMemberId,
                                orElse: () =>
                                    const <String, ParentLinkStatus>{},
                              )
                          : const <String, ParentLinkStatus>{};

                      return ViroRefreshIndicator(
                        onRefresh: () async {
                          await Future.wait([
                            ref.refresh(clubForMembersProvider(clubId).future),
                            ref.refresh(
                                clubMembersWithInvitesProvider(clubId).future),
                            ref.refresh(clubMemberProvider(clubId).future),
                            if (_isAdmin)
                              ref.refresh(clubParentsProvider(clubId).future),
                          ]);
                        },
                        child: CustomScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          slivers: [
                            if (_isAdmin)
                              SliverToBoxAdapter(
                                child: SingleChildScrollView(
                                  scrollDirection: Axis.horizontal,
                                  padding: const EdgeInsets.fromLTRB(
                                    ViroSpacing.screenHorizontal,
                                    ViroSpacing.md,
                                    ViroSpacing.screenHorizontal,
                                    ViroSpacing.xs,
                                  ),
                                  child: Row(
                                    children: [
                                      _roleFilterChip(
                                        label: AppCopy.members.tabMembers,
                                        selected: _section == 'roster',
                                        accentColor: accent,
                                        onSelected: (_) =>
                                            setState(() => _section = 'roster'),
                                      ),
                                      const SizedBox(width: ViroSpacing.xs),
                                      _roleFilterChip(
                                        label: AppCopy.members.tabTeams,
                                        selected: false,
                                        accentColor: accent,
                                        onSelected: (_) => _openManageTeams(),
                                      ),
                                      const SizedBox(width: ViroSpacing.xs),
                                      _roleFilterChip(
                                        label: AppCopy.members.tabParents,
                                        selected: _section == 'parents',
                                        accentColor: accent,
                                        onSelected: (_) => setState(
                                            () => _section = 'parents'),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            if (_section == 'parents' && _isAdmin)
                              SliverToBoxAdapter(
                                child: ParentsSection(
                                  clubId: clubId,
                                  club: club,
                                  members: members,
                                  accentColor: accent,
                                ),
                              )
                            else ...[
                              SliverToBoxAdapter(
                                child: Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                    ViroSpacing.screenHorizontal,
                                    ViroSpacing.md,
                                    ViroSpacing.screenHorizontal,
                                    ViroSpacing.sm,
                                  ),
                                  child: TextField(
                                    controller: _searchController,
                                    decoration: InputDecoration(
                                      hintText: AppCopy.members.searchMemberHint,
                                      prefixIcon: ViroIcon(ViroIcons.search),
                                    ),
                                    onChanged: (v) =>
                                        setState(() => _search = v.trim()),
                                  ),
                                ),
                              ),
                              SliverToBoxAdapter(
                                child: SingleChildScrollView(
                                  scrollDirection: Axis.horizontal,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: ViroSpacing.screenHorizontal,
                                  ),
                                  child: Row(
                                    children: [
                                      _roleFilterChip(
                                        label: AppCopy.common.filterAll,
                                        selected: _roleFilter == null,
                                        accentColor: accent,
                                        onSelected: (_) =>
                                            setState(() => _roleFilter = null),
                                      ),
                                      const SizedBox(width: ViroSpacing.xs),
                                      _roleFilterChip(
                                        label: AppCopy.members.filterPlayers,
                                        selected:
                                            _roleFilter == MemberRoles.player,
                                        accentColor: accent,
                                        onSelected: (_) => setState(
                                          () =>
                                              _roleFilter = MemberRoles.player,
                                        ),
                                      ),
                                      const SizedBox(width: ViroSpacing.xs),
                                      _roleFilterChip(
                                        label: AppCopy.members.tabCoaches,
                                        selected:
                                            _roleFilter == MemberRoles.coach,
                                        accentColor: accent,
                                        onSelected: (_) => setState(
                                          () => _roleFilter = MemberRoles.coach,
                                        ),
                                      ),
                                      if (_isAdmin) ...[
                                        const SizedBox(width: ViroSpacing.xs),
                                        _roleFilterChip(
                                          label: AppCopy.members.filterAdmins,
                                          selected:
                                              _roleFilter == MemberRoles.admin,
                                          accentColor: accent,
                                          onSelected: (_) => setState(
                                            () =>
                                                _roleFilter = MemberRoles.admin,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                              if (_canInviteAll &&
                                  !_selectionMode &&
                                  eligibleInviteCount > 0)
                                SliverToBoxAdapter(
                                  child: Padding(
                                    padding: const EdgeInsets.fromLTRB(
                                      ViroSpacing.screenHorizontal,
                                      ViroSpacing.md,
                                      ViroSpacing.screenHorizontal,
                                      ViroSpacing.xs,
                                    ),
                                    child: Builder(
                                      builder: (context) {
                                        _syncBulkInviteCooldownTicker(
                                          club.lastBulkMemberInviteAt,
                                        );
                                        final cooldown =
                                            _bulkInviteCooldownRemaining(
                                          club.lastBulkMemberInviteAt,
                                        );
                                        final onCooldown = cooldown != null;
                                        final label = _inviteAllBusy
                                            ? AppCopy.members.sending
                                            : onCooldown
                                                ? AppCopy.members.inviteAllRetryIn(_formatCooldown(cooldown))
                                                : AppCopy.members.inviteAllLabel(eligibleInviteCount);
                                        return ViroPrimaryButton(
                                          label: label,
                                          isLoading: _inviteAllBusy,
                                          onPressed: _inviteAllBusy ||
                                                  onCooldown
                                              ? null
                                              : () =>
                                                  _inviteAllPending(members),
                                        );
                                      },
                                    ),
                                  ),
                                ),
                              if (filtered.isEmpty)
                                SliverFillRemaining(
                                  hasScrollBody: false,
                                  child: Center(
                                    child: Text(
                                      _search.isNotEmpty
                                          ? AppCopy.members.emptySearch
                                          : AppCopy.members.empty,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium
                                          ?.copyWith(color: ViroColors.gray600),
                                    ),
                                  ),
                                )
                              else
                                SliverPadding(
                                  padding: const EdgeInsets.fromLTRB(
                                    ViroSpacing.screenHorizontal,
                                    ViroSpacing.sm,
                                    ViroSpacing.screenHorizontal,
                                    ViroSpacing.md,
                                  ),
                                  sliver: SliverList(
                                    delegate: SliverChildBuilderDelegate(
                                      (context, index) {
                                        final member = filtered[index];
                                        final isSelected = _selectedMemberIds
                                            .contains(member.memberId);
                                        return MemberListTile(
                                          member: member,
                                          club: club,
                                          viewerRole: viewerRole,
                                          accentColor: accent,
                                          selectionMode: _selectionMode,
                                          selected: isSelected,
                                          onLongPress: _canSelectMembers
                                              ? () =>
                                                  _enterSelectionMode(member)
                                              : null,
                                          onTap: _selectionMode
                                              ? () =>
                                                  _toggleMemberSelection(member)
                                              : member.hasLinkedAccount
                                                  ? () => showMemberDetailSheet(
                                                        context,
                                                        ref: ref,
                                                        club: club,
                                                        member: member,
                                                        viewerRole: viewerRole,
                                                        accentColor: accent,
                                                      )
                                                  : _canAdd
                                                      ? () =>
                                                          showPendingMemberSheet(
                                                            context,
                                                            club: club,
                                                            member: member,
                                                            canEdit: _canAdd,
                                                          )
                                                      : null,
                                          onChangeRole: _isAdmin
                                              ? () => _changeRole(member)
                                              : null,
                                          onInviteParent: _isAdmin &&
                                                  member.role ==
                                                      MemberRoles.player
                                              ? () => showInviteParentSheet(
                                                    context,
                                                    club: club,
                                                    member: member,
                                                  )
                                              : null,
                                          onRemove: _isAdmin
                                              ? () => _removeMember(member)
                                              : null,
                                          onSendEmailInvite: _canAdd
                                              ? () => _emailInvite(member)
                                              : null,
                                          parentLinkStatus: _isAdmin &&
                                                  member.role ==
                                                      MemberRoles.player
                                              ? parentStatusByMemberId[
                                                      member.memberId] ??
                                                  ParentLinkStatus.none
                                              : null,
                                        );
                                      },
                                      childCount: filtered.length,
                                    ),
                                  ),
                                ),
                              const SliverToBoxAdapter(
                                child: SizedBox(height: ViroSpacing.xl),
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
            ),
            if (_inviteAllBusy)
              Positioned.fill(
                child: MemberInviteProgressOverlay(
                  completedCount: _inviteProgressDone,
                  totalCount: _inviteProgressTotal,
                  currentMemberName: _inviteProgressName,
                  phaseLabel: _inviteProgressPhase,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
