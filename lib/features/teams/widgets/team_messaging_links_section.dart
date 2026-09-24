import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// CTA vers les chats in-app équipe / parents (remplace les liens WhatsApp).
class TeamMessagingLinksSection extends ConsumerWidget {
  const TeamMessagingLinksSection({
    super.key,
    required this.team,
    required this.accent,
  });

  final ClubTeam team;
  final Color accent;

  Future<void> _openSystemChat(
    BuildContext context,
    WidgetRef ref, {
    required String systemKey,
  }) async {
    try {
      final id = await ref.read(chatServiceProvider).ensureAndFindConversationId(
            clubId: team.clubId,
            systemKey: systemKey,
          );
      if (!context.mounted) return;
      if (id == null) {
        ViroSnackBar.show(context, AppCopy.chat.loadError);
        return;
      }
      context.push(AppRoutes.conversationPath(team.clubId, id));
    } catch (_) {
      if (context.mounted) {
        ViroSnackBar.show(context, AppCopy.chat.loadError);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context).textTheme;
    // Parents seuls : pas dans `team:{id}` (joueurs + coaches uniquement).
    final isGuardianOnly =
        ref.watch(isGuardianOnlyInClubProvider(team.clubId));

    return Padding(
      padding: const EdgeInsets.only(top: ViroSpacing.sm, bottom: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            AppCopy.teams.discussionsHeader,
            style: theme.labelSmall?.copyWith(
              color: accent,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
            ),
          ),
          if (!isGuardianOnly)
            _MessagingLinkTile(
              icon: ViroIcons.chat,
              label: AppCopy.chat.openTeamChat,
              accent: accent,
              onTap: () => _openSystemChat(
                context,
                ref,
                systemKey: 'team:${team.id}',
              ),
            ),
          _MessagingLinkTile(
            icon: ViroIcons.users,
            label: AppCopy.chat.openParentsChat,
            accent: accent,
            onTap: () => _openSystemChat(
              context,
              ref,
              systemKey: 'parents:${team.id}',
            ),
          ),
        ],
      ),
    );
  }
}

class _MessagingLinkTile extends StatelessWidget {
  const _MessagingLinkTile({
    required this.icon,
    required this.label,
    required this.accent,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return ViroPressable(
      floating: false,
      borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          vertical: ViroSpacing.sm,
          horizontal: ViroSpacing.xs,
        ),
        child: Row(
          children: [
            ViroIcon(icon, size: 22, color: accent),
            const SizedBox(width: ViroSpacing.md),
            Expanded(
              child: Text(
                label,
                style: theme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: ViroColors.primary800,
                ),
              ),
            ),
            ViroIcon(
              ViroIcons.chevronRight,
              size: 18,
              color: ViroColors.gray400,
            ),
          ],
        ),
      ),
    );
  }
}
