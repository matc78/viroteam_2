import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/features/members/providers/member_providers.dart';
import 'package:viro_team_v2/features/members/utils/parent_status_for_member.dart';
import 'package:viro_team_v2/features/members/widgets/add_member_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/change_role_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/invite_parent_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/member_list_tile.dart';
import 'package:viro_team_v2/features/members/widgets/member_detail_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/pending_member_sheet.dart';
import 'package:viro_team_v2/features/members/widgets/parents_section.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/callable_error.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_floating_icon_button.dart';
import 'package:viro_team_v2/widgets/common/viro_empty_error_state.dart';
import 'package:viro_team_v2/widgets/common/viro_refresh_indicator.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

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

  Future<void> _openManageTeams() async {
    await context.push(AppRoutes.clubManageTeamsPath(widget.clubId));
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
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
      final result =
          await ref.read(memberInviteServiceProvider).sendMemberInvites(
                clubId: widget.clubId,
                memberIds: [member.memberId],
              );
      if (result.sent > 0) return true;
      final first = result.results.isNotEmpty ? result.results.first : null;
      throw Exception(
        first?.reason ?? 'Impossible d\'envoyer l\'invitation.',
      );
    } catch (error) {
      if (mounted) {
        ViroSnackBar.show(
          context,
          callableErrorMessage(
            error,
            fallback: 'Envoi de l\'invitation impossible.',
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
        callableErrorMessage(error, fallback: 'Changement de rôle impossible.'),
      );
    }
  }

  Future<void> _removeMember(ClubMember member) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Theme(
        data: Theme.of(context),
        child: AlertDialog(
        title: const Text('Supprimer ce membre ?'),
        content: Text(
          '${member.fullName} sera retiré(e) du club.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              'Supprimer',
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
        callableErrorMessage(error, fallback: 'Suppression du membre impossible.'),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final clubId = widget.clubId;
    final membersAsync = ref.watch(clubMembersProvider(clubId));
    final clubAsync = ref.watch(clubForMembersProvider(clubId));
    final accent = ref.watch(clubManagementAccentProvider(clubId));
    final memberAccent = ref.watch(clubMemberAccentProvider(clubId));

    return ClubAccentTheme(
      accentColor: memberAccent,
      child: ViroScaffold(
      appBar: ViroAppBar(
        leading: IconButton(
          icon: ViroIcon(ViroIcons.chevronLeft),
          onPressed: () => context.pop(),
        ),
        title: const Text('Gérer les membres'),
      ),
      floatingActionButton: _canAdd && _section == 'roster'
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
            return const Center(child: Text('Club introuvable'));
          }

          return membersAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, stackTrace) => const ViroErrorState(),
            data: (members) {
              final viewerRole =
                  ref.watch(clubMemberProvider(clubId)).value?.role ??
                      MemberRoles.player;
              final filtered = _filterMembers(members);
              final parentStatusByMemberId = _isAdmin
                  ? ref.watch(clubParentsProvider(clubId)).maybeWhen(
                        data: buildParentStatusByMemberId,
                        orElse: () => const <String, ParentLinkStatus>{},
                      )
                  : const <String, ParentLinkStatus>{};

              return ViroRefreshIndicator(
                onRefresh: () async {
                  await Future.wait([
                    ref.refresh(clubForMembersProvider(clubId).future),
                    ref.refresh(clubMembersProvider(clubId).future),
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
                              label: 'Membres',
                              selected: _section == 'roster',
                              accentColor: accent,
                              onSelected: (_) =>
                                  setState(() => _section = 'roster'),
                            ),
                            const SizedBox(width: ViroSpacing.xs),
                            _roleFilterChip(
                              label: 'Équipes',
                              selected: false,
                              accentColor: accent,
                              onSelected: (_) => _openManageTeams(),
                            ),
                            const SizedBox(width: ViroSpacing.xs),
                            _roleFilterChip(
                              label: 'Parents',
                              selected: _section == 'parents',
                              accentColor: accent,
                              onSelected: (_) =>
                                  setState(() => _section = 'parents'),
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
                            hintText: 'Rechercher un membre…',
                            prefixIcon: ViroIcon(ViroIcons.search),
                          ),
                          onChanged: (v) => setState(() => _search = v.trim()),
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
                              label: 'Tous',
                              selected: _roleFilter == null,
                              accentColor: accent,
                              onSelected: (_) =>
                                  setState(() => _roleFilter = null),
                            ),
                            const SizedBox(width: ViroSpacing.xs),
                            _roleFilterChip(
                              label: 'Joueurs',
                              selected: _roleFilter == MemberRoles.player,
                              accentColor: accent,
                              onSelected: (_) => setState(
                                () => _roleFilter = MemberRoles.player,
                              ),
                            ),
                            const SizedBox(width: ViroSpacing.xs),
                            _roleFilterChip(
                              label: 'Coachs',
                              selected: _roleFilter == MemberRoles.coach,
                              accentColor: accent,
                              onSelected: (_) => setState(
                                () => _roleFilter = MemberRoles.coach,
                              ),
                            ),
                            if (_isAdmin) ...[
                              const SizedBox(width: ViroSpacing.xs),
                              _roleFilterChip(
                                label: 'Admins',
                                selected: _roleFilter == MemberRoles.admin,
                                accentColor: accent,
                                onSelected: (_) => setState(
                                  () => _roleFilter = MemberRoles.admin,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    if (filtered.isEmpty)
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: Center(
                          child: Text(
                            _search.isNotEmpty
                                ? 'Aucun membre trouvé'
                                : 'Aucun membre pour le moment',
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
                              return MemberListTile(
                                member: member,
                                club: club,
                                viewerRole: viewerRole,
                                accentColor: accent,
                                onTap: member.hasLinkedAccount
                                    ? () => showMemberDetailSheet(
                                          context,
                                          ref: ref,
                                          club: club,
                                          member: member,
                                          viewerRole: viewerRole,
                                          accentColor: accent,
                                        )
                                    : _canAdd
                                        ? () => showPendingMemberSheet(
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
                                        member.role == MemberRoles.player
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
                                        member.role == MemberRoles.player
                                    ? parentStatusByMemberId[member.memberId] ??
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
    );
  }
}
