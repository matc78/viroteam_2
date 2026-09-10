import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/club/widgets/club_context_avatar.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Bandeau bas fixe des clubs (fond verre dépoli + logos).
class ClubSelectorBar extends ConsumerWidget {
  const ClubSelectorBar({
    super.key,
    required this.clubs,
    required this.pendingByClub,
    this.onAddClub,
  });

  final List<UserClubEntry> clubs;
  final Map<String, int> pendingByClub;
  final VoidCallback? onAddClub;

  /// Hauteur utile des logos (hors safe area bas).
  static const double barHeight = 88;
  static const double _logoSize = 56;
  static const double _addButtonSize = 36;
  static const double _glassBlurSigma = 18;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = clubs.map((entry) {
      final club = entry.club;
      final membership = entry.membership;
      final pending = pendingByClub[club.id] ?? 0;
      final familyChild = ref.watch(familyPrimaryChildProvider(club.id)).value;
      return _ClubBarItem(
        label: _shortName(club.name),
        club: club,
        childMember: familyChild,
        role: membership == null
            ? null
            : viroRoleFromMemberRole(membership.role),
        accentColor: clubAccentColor(
          brandColorHex: club.brandColorHex,
          clubId: club.id,
        ),
        badgeCount: pending > 0 ? pending : null,
        onTap: () => context.push(AppRoutes.clubDetailPath(club.id)),
      );
    }).toList();

    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(
          sigmaX: _glassBlurSigma,
          sigmaY: _glassBlurSigma,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: ViroColors.scaffold.withValues(alpha: 0.72),
            border: Border(
              top: BorderSide(
                color: ViroColors.primary100.withValues(alpha: 0.55),
              ),
            ),
          ),
          child: SizedBox(
            height: barHeight + bottomInset,
            child: Stack(
              children: [
                Positioned.fill(
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      return SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(
                          horizontal: ViroSpacing.screenHorizontal,
                        ),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minWidth: constraints.maxWidth -
                                ViroSpacing.screenHorizontal * 2,
                            minHeight: constraints.maxHeight,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: items,
                          ),
                        ),
                      );
                    },
                  ),
                ),
                if (onAddClub != null)
                  Positioned(
                    right: ViroSpacing.screenHorizontal,
                    top: 0,
                    bottom: 0,
                    child: Center(
                      child: _AddClubBarItem(onTap: onAddClub!),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _shortName(String name) {
    if (name.length <= 12) return name;
    return '${name.substring(0, 10)}…';
  }
}

class _AddClubBarItem extends StatelessWidget {
  const _AddClubBarItem({required this.onTap});

  final VoidCallback onTap;

  static const double _size = ClubSelectorBar._addButtonSize;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: AppCopy.home.addClub,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: _size,
          height: _size,
          decoration: BoxDecoration(
            color: ViroColors.primary50,
            shape: BoxShape.circle,
            border: Border.all(
              color: ViroColors.primary200,
              width: 1,
            ),
          ),
          alignment: Alignment.center,
          child: ViroIcon(
            ViroIcons.add,
            size: 16,
            color: ViroColors.primary600,
          ),
        ),
      ),
    );
  }
}

class _ClubBarItem extends StatelessWidget {
  const _ClubBarItem({
    required this.label,
    required this.club,
    required this.onTap,
    this.childMember,
    this.role,
    this.accentColor,
    this.badgeCount,
  });

  final String label;
  final Club club;
  final VoidCallback onTap;
  final ClubMember? childMember;
  final ViroRole? role;
  final Color? accentColor;
  final int? badgeCount;

  static const double _logoSize = ClubSelectorBar._logoSize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final color = accentColor ?? ViroColors.primary600;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.sm / 2),
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                ClubContextAvatar(
                  club: club,
                  accentColor: color,
                  childMember: childMember,
                  size: _logoSize,
                  borderRadius: _logoSize / 2,
                ),
                if (badgeCount != null)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: ViroColors.error,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 18,
                        minHeight: 18,
                      ),
                      child: Text(
                        '$badgeCount',
                        textAlign: TextAlign.center,
                        style: theme.labelSmall?.copyWith(
                          color: ViroColors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                if (role != null)
                  Positioned(
                    bottom: -2,
                    right: -2,
                    child: ViroRoleSatelliteBadge(role: role!),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            SizedBox(
              width: 64,
              height: 14,
              child: Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.labelSmall?.copyWith(
                  fontSize: 10,
                  height: 1.1,
                  color: ViroColors.gray600,
                  fontWeight: FontWeight.w400,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
