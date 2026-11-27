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
import 'package:viro_team_v2/features/teams/utils/team_category_groups.dart';
import 'package:viro_team_v2/features/teams/utils/team_roster_members.dart';
import 'package:viro_team_v2/features/teams/widgets/team_card_header.dart';
import 'package:viro_team_v2/features/teams/widgets/team_quick_actions.dart';
import 'package:viro_team_v2/features/teams/widgets/team_roster_section.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';
import 'package:viro_team_v2/widgets/lists/member_list_tile.dart';

/// Carte dépliable d'une de mes équipes (lecture seule) : actions rapides,
/// staff, coéquipiers et joueurs en attente.
class TeamExpansionCard extends ConsumerStatefulWidget {
  const TeamExpansionCard({
    super.key,
    required this.team,
    required this.club,
    required this.accent,
  });

  final ClubTeam team;
  final Club club;
  final Color accent;

  @override
  ConsumerState<TeamExpansionCard> createState() => _TeamExpansionCardState();
}

class _TeamExpansionCardState extends ConsumerState<TeamExpansionCard> {
  List<PendingTeamMember>? _pending;
  bool _loadingPending = false;
  bool _expanded = false;

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

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final team = widget.team;

    final membersAsync = ref.watch(clubMembersProvider(team.clubId));
    final sessionMemberId =
        ref.watch(rosterSessionMemberIdProvider(team.clubId));
    final membersByUid = membersAsync.value != null
        ? indexClubMembersById(membersAsync.value!)
        : <String, ClubMember>{};

    return ViroCard(
      margin: const EdgeInsets.only(bottom: ViroSpacing.sm),
      padding: EdgeInsets.zero,
      child: Theme(
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
            categoryColor: teamCategoryToneOf(
              ref.watch(teamCategoryTonesProvider(team.clubId)),
              team,
            ).color,
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
                showStandings: true,
              ),
              TeamRosterSection(
                title: AppCopy.teams.staffCoachesSection,
                titleColor: ViroColors.coachBadgeEnd,
                showWhenEmpty: false,
                children: _memberTiles(
                  team.coachIds,
                  membersByUid: membersByUid,
                  sessionMemberId: sessionMemberId,
                  displayRole: ViroRole.coach,
                ),
              ),
              TeamRosterSection(
                title: AppCopy.teams.teammatesSection,
                titleColor: widget.accent,
                showWhenEmpty: false,
                children: _memberTiles(
                  team.playerIds,
                  membersByUid: membersByUid,
                  sessionMemberId: sessionMemberId,
                  displayRole: ViroRole.player,
                  sparringIds: team.sparringIds.toSet(),
                ),
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
                        ),
                    ],
                  ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  /// Lignes de roster des [uids] connus (membre en session en tête) ; les
  /// [sparringIds] affichent le badge Sparring à la place de [displayRole].
  List<Widget> _memberTiles(
    List<String> uids, {
    required Map<String, ClubMember> membersByUid,
    required String? sessionMemberId,
    required ViroRole displayRole,
    Set<String> sparringIds = const {},
  }) {
    final orderedIds = pinSessionMemberIdFirst(
      uids,
      sessionMemberId: sessionMemberId,
    );
    return [
      for (final uid in orderedIds)
        if (membersByUid[uid] case final member?)
          MemberListTile(
            member: member,
            club: widget.club,
            accentColor: widget.accent,
            showClubAdminActions: false,
            embedded: true,
            displayRole:
                sparringIds.contains(uid) ? ViroRole.sparring : displayRole,
            isSessionMember: member.memberId == sessionMemberId,
            onTap: member.hasLinkedAccount
                ? () => showMemberDetailSheet(
                      context,
                      ref: ref,
                      club: widget.club,
                      member: member,
                      accentColor: widget.accent,
                    )
                : null,
          ),
    ];
  }
}
