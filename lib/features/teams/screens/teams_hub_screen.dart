import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/constants/firestore_fields.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_detail_providers.dart';
import 'package:viro_team_v2/features/club/utils/coach_permissions.dart';
import 'package:viro_team_v2/features/auth/providers/auth_providers.dart';
import 'package:viro_team_v2/features/teams/utils/team_manage_permissions.dart';
import 'package:viro_team_v2/features/teams/widgets/manage_teams_body.dart';
import 'package:viro_team_v2/features/teams/widgets/my_teams_body.dart';
import 'package:viro_team_v2/widgets/common/club_accent_theme.dart';
import 'package:viro_team_v2/widgets/common/viro_floating_icon_button.dart';
import 'package:viro_team_v2/widgets/common/viro_scaffold.dart';

/// Hub unique Équipes : Mes équipes + Gestion (coach+).
class TeamsHubScreen extends ConsumerStatefulWidget {
  const TeamsHubScreen({
    super.key,
    required this.clubId,
    this.initialTab = TeamsHubTab.mine,
  });

  final String clubId;
  final TeamsHubTab initialTab;

  @override
  ConsumerState<TeamsHubScreen> createState() => _TeamsHubScreenState();
}

enum TeamsHubTab { mine, manage }

class _TeamsHubScreenState extends ConsumerState<TeamsHubScreen> {
  late TeamsHubTab _tab;

  @override
  void initState() {
    super.initState();
    _tab = widget.initialTab;
  }

  Widget _sectionChip({
    required String label,
    required bool selected,
    required ValueChanged<bool> onSelected,
    required Color accent,
  }) {
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
      side: BorderSide(color: selected ? accent : ViroColors.gray200),
    );
  }

  @override
  Widget build(BuildContext context) {
    final clubAsync = ref.watch(clubProvider(widget.clubId));
    final memberAsync = ref.watch(clubMemberProvider(widget.clubId));
    final authUid = ref.watch(authStateProvider).value?.uid;
    final memberAccent = ref.watch(clubMemberAccentProvider(widget.clubId));
    final managementAccent =
        ref.watch(clubManagementAccentProvider(widget.clubId));

    final role = memberAsync.value?.role ?? MemberRoles.player;
    final canManage = MemberRoleHierarchy.isCoachOrAbove(role);
    final effectiveTab =
        canManage ? _tab : TeamsHubTab.mine;

    final permissions = TeamManagePermissions(
      viewerRole: role,
      currentUid: authUid,
      coachPermissions:
          clubAsync.value?.coachPermissions ?? CoachPermissions.defaults,
    );

    final accent =
        effectiveTab == TeamsHubTab.manage ? managementAccent : memberAccent;

    return ClubAccentTheme(
      accentColor: memberAccent,
      child: ViroScaffold(
        appBar: ViroAppBar(
          leading: IconButton(
            icon: ViroIcon(ViroIcons.chevronLeft),
            onPressed: () => context.pop(),
          ),
          title: Text(AppCopy.teams.hubTitle),
        ),
        floatingActionButton: effectiveTab == TeamsHubTab.manage &&
                permissions.canCreateTeam()
            ? clubAsync.maybeWhen(
                data: (club) {
                  if (club == null) return null;
                  return ViroFloatingActionButton(
                    icon: ViroIcons.add,
                    onPressed: () => createClubTeam(
                      context: context,
                      ref: ref,
                      clubId: widget.clubId,
                      sport: club.sport,
                    ),
                  );
                },
                orElse: () => null,
              )
            : null,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (canManage)
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(
                  ViroSpacing.screenHorizontal,
                  ViroSpacing.md,
                  ViroSpacing.screenHorizontal,
                  ViroSpacing.sm,
                ),
                child: Row(
                  children: [
                    _sectionChip(
                      label: AppCopy.teams.hubTabMine,
                      selected: effectiveTab == TeamsHubTab.mine,
                      accent: accent,
                      onSelected: (_) =>
                          setState(() => _tab = TeamsHubTab.mine),
                    ),
                    const SizedBox(width: ViroSpacing.sm),
                    _sectionChip(
                      label: AppCopy.teams.hubTabManage,
                      selected: effectiveTab == TeamsHubTab.manage,
                      accent: accent,
                      onSelected: (_) =>
                          setState(() => _tab = TeamsHubTab.manage),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: effectiveTab == TeamsHubTab.manage
                  ? ManageTeamsBody(clubId: widget.clubId)
                  : MyTeamsBody(clubId: widget.clubId),
            ),
          ],
        ),
      ),
    );
  }
}
