import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/widgets/lists/club_management_list_tile.dart';
import 'package:viro_team_v2/models/club_access.dart';
import 'package:viro_team_v2/models/club_permission.dart';

/// Entrée de gestion (libellé, sous-titre informatif, icône, action).
class _ManagementEntry {
  const _ManagementEntry({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;
}

/// Zone de gestion en listes groupées : « Membres et activité » puis
/// « Club ». Chaque entrée n'apparaît qu'avec le droit qui l'ouvre
/// ([ClubAccess]) ; un groupe vide est masqué.
///
/// [memberCount] / [pendingCount] alimentent le sous-titre de « Membres ».
/// [accentColor] teinte les tuiles (couleur de zone gestion du club).
class ClubManagementList extends StatelessWidget {
  const ClubManagementList({
    super.key,
    required this.access,
    required this.accentColor,
    required this.memberCount,
    this.pendingCount = 0,
    required this.onMembers,
    required this.onActivity,
    required this.onFees,
    required this.onAppearance,
    required this.onLocations,
    required this.onEquipment,
    required this.onSettings,
  });

  final ClubAccess access;
  final Color accentColor;
  final int memberCount;
  final int pendingCount;
  final VoidCallback onMembers;
  final VoidCallback onActivity;
  final VoidCallback onFees;
  final VoidCallback onAppearance;
  final VoidCallback onLocations;
  final VoidCallback onEquipment;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    final canEditClub = access.can(ClubPermission.manageClubSettings);

    final people = [
      if (access.canOpenMembers)
      _ManagementEntry(
        title: AppCopy.club.actionManageMembers,
        subtitle: pendingCount > 0
            ? AppCopy.club.membersWithPending(memberCount, pendingCount)
            : AppCopy.club.membersCount(memberCount),
        icon: ViroIcons.groups,
        onTap: onMembers,
      ),
      if (access.can(ClubPermission.viewActivity))
      _ManagementEntry(
        title: AppCopy.club.actionRecentActivity,
        subtitle: AppCopy.club.activitySubtitle,
        icon: ViroIcons.clock,
        onTap: onActivity,
      ),
    ];

    final club = [
      if (access.can(ClubPermission.viewFees))
      _ManagementEntry(
        title: AppCopy.club.actionFeesTracking,
        subtitle: AppCopy.club.feesTrackingSubtitle,
        icon: ViroIcons.payments,
        onTap: onFees,
      ),
      if (canEditClub)
      _ManagementEntry(
        title: AppCopy.club.actionAppearance,
        subtitle: AppCopy.club.appearanceSubtitle,
        icon: ViroIcons.image,
        onTap: onAppearance,
      ),
      if (canEditClub)
      _ManagementEntry(
        title: AppCopy.club.actionLocations,
        subtitle: AppCopy.club.locationsSubtitle,
        icon: ViroIcons.place,
        onTap: onLocations,
      ),
      if (access.can(ClubPermission.manageEquipment))
      _ManagementEntry(
        title: AppCopy.club.actionEquipment,
        subtitle: AppCopy.club.equipmentSubtitle,
        icon: ViroIcons.ball,
        onTap: onEquipment,
      ),
      if (canEditClub)
      _ManagementEntry(
        title: AppCopy.club.actionSettings,
        subtitle: AppCopy.club.settingsSubtitle,
        icon: ViroIcons.settings,
        onTap: onSettings,
      ),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.screenHorizontal,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (people.isNotEmpty)
            _ManagementGroup(
              title: AppCopy.club.managementPeopleGroup,
              accentColor: accentColor,
              entries: people,
            ),
          if (club.isNotEmpty)
            _ManagementGroup(
              title: AppCopy.club.managementClubGroup,
              accentColor: accentColor,
              entries: club,
            ),
        ],
      ),
    );
  }
}

class _ManagementGroup extends StatelessWidget {
  const _ManagementGroup({
    required this.title,
    required this.accentColor,
    required this.entries,
  });

  final String title;
  final Color accentColor;
  final List<_ManagementEntry> entries;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            left: ViroSpacing.xs,
            bottom: ViroSpacing.xs,
          ),
          child: Text(
            title.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: palette.textMuted,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                ),
          ),
        ),
        for (final entry in entries)
          ClubManagementListTile(
            title: entry.title,
            subtitle: entry.subtitle,
            icon: entry.icon,
            accentColor: accentColor,
            onTap: entry.onTap,
          ),
        const SizedBox(height: ViroSpacing.sm),
      ],
    );
  }
}
