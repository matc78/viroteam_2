import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club/providers/club_audience_providers.dart';
import 'package:viro_team_v2/features/club/widgets/club_context_avatar.dart';
import 'package:viro_team_v2/features/clubs/providers/user_clubs_provider.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Contenu affiché sur la home membre quand aucun événement n'est planifié.
class HomeQuietContent extends StatelessWidget {
  const HomeQuietContent({
    super.key,
    required this.clubs,
    this.firstName,
  });

  final List<UserClubEntry> clubs;
  final String? firstName;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final greeting = _greeting(firstName);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        0,
        ViroSpacing.screenHorizontal,
        ViroSpacing.xl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            greeting,
            style: theme.headlineSmall?.copyWith(
              color: ViroColors.primary800,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: ViroSpacing.xs),
          Text(
            'Votre planning est à jour — rien à venir pour le moment.',
            style: theme.bodyMedium?.copyWith(color: ViroColors.gray600),
          ),
          const SizedBox(height: ViroSpacing.lg),
          const _EmptyPlanningCard(),
          if (clubs.isNotEmpty) ...[
            const SizedBox(height: ViroSpacing.lg),
            Text(
              clubs.length == 1 ? 'Votre club' : 'Vos clubs',
              style: theme.titleSmall?.copyWith(
                color: ViroColors.primary800,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: ViroSpacing.sm),
            ...clubs.map(
              (entry) => _ClubShortcutTile(
                entry: entry,
                onTap: () => context.push(
                  AppRoutes.clubDetailPath(entry.club.id),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _greeting(String? name) {
    final hour = DateTime.now().hour;
    final salutation = hour < 18 ? 'Bonjour' : 'Bonsoir';
    final trimmed = name?.trim();
    if (trimmed != null && trimmed.isNotEmpty) {
      return '$salutation, $trimmed';
    }
    return salutation;
  }
}

class _EmptyPlanningCard extends StatelessWidget {
  const _EmptyPlanningCard();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return ViroCard(
      elevated: false,
      margin: EdgeInsets.zero,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Color.lerp(ViroColors.white, ViroColors.primary100, 0.6)!,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: ViroIcon(
              ViroIcons.calendar,
              size: 24,
              color: ViroColors.primary600,
            ),
          ),
          const SizedBox(width: ViroSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Rien de prévu pour l\'instant',
                  style: theme.titleSmall?.copyWith(
                    color: ViroColors.primary800,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: ViroSpacing.xs),
                Text(
                  'Les entraînements et matchs programmés dans vos clubs '
                  's\'afficheront ici automatiquement.',
                  style: theme.bodySmall?.copyWith(
                    color: ViroColors.gray600,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ClubShortcutTile extends ConsumerWidget {
  const _ClubShortcutTile({
    required this.entry,
    required this.onTap,
  });

  final UserClubEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context).textTheme;
    final club = entry.club;
    final membership = entry.membership;
    final accent = clubAccentColor(
      brandColorHex: club.brandColorHex,
      clubId: club.id,
    );
    final familyChild = ref.watch(familyPrimaryChildProvider(club.id)).value;
    final location = club.city?.trim();
    final subtitle = [
      club.sport,
      if (location != null && location.isNotEmpty) location,
    ].join(' • ');

    return ViroCard(
      accentColor: accent,
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.sm + 2,
      ),
      child: Row(
        children: [
          ClubContextAvatar(
            club: club,
            accentColor: accent,
            childMember: familyChild,
            borderRadius: 22,
          ),
          const SizedBox(width: ViroSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  club.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.titleSmall?.copyWith(
                    color: ViroColors.primary800,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (subtitle.isNotEmpty)
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.bodySmall?.copyWith(
                      color: ViroColors.gray600,
                    ),
                  ),
              ],
            ),
          ),
          if (membership != null)
            ViroRoleBadge(
              role: viroRoleFromMemberRole(membership.role),
              compact: true,
            ),
          const SizedBox(width: ViroSpacing.xs),
          ViroIcon(
            ViroIcons.chevronRight,
            size: 18,
            color: ViroColors.gray400,
          ),
        ],
      ),
    );
  }
}
