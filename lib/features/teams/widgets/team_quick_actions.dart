import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/chat/open_chat_thread.dart';
import 'package:viro_team_v2/features/chat/providers/chat_messaging_live_provider.dart';
import 'package:viro_team_v2/features/club/providers/guardian_scope_providers.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Pastilles d'actions rapides d'une carte d'équipe dépliée : chats équipe /
/// parents (messagerie live), invitation (si [onInvite]) et classement
/// (si [showStandings] et équipe liée à la fédération).
class TeamQuickActions extends ConsumerWidget {
  const TeamQuickActions({
    super.key,
    required this.team,
    required this.accent,
    this.onInvite,
    this.showStandings = false,
  });

  final ClubTeam team;
  final Color accent;

  /// Ouvre la feuille du code d'invitation d'équipe ; `null` = pas de pastille.
  final VoidCallback? onInvite;

  /// Pastille « Classement » (Mes équipes ; dans Gérer, le bloc FFVB s'en charge).
  final bool showStandings;

  /// Ouvre (en la créant au besoin) la conversation système [systemKey].
  Future<void> _openSystemChat(
    BuildContext context,
    WidgetRef ref, {
    required String systemKey,
    required String title,
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
      openChatThread(
        context,
        ref,
        clubId: team.clubId,
        conversationId: id,
        title: title,
        clubColor: accent,
        isGroup: true,
      );
    } catch (_) {
      if (context.mounted) {
        ViroSnackBar.show(context, AppCopy.chat.loadError);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messagingLive = ref.watch(chatMessagingLiveProvider);
    // Parents seuls : pas dans `team:{id}` (joueurs + coaches uniquement).
    final isGuardianOnly =
        ref.watch(isGuardianOnlyInClubProvider(team.clubId));
    final copy = AppCopy.teams;

    final actions = <Widget>[
      if (messagingLive && !isGuardianOnly)
        TeamQuickActionChip(
          icon: ViroIcons.chat,
          label: copy.teamChatShort,
          accent: accent,
          onTap: () => _openSystemChat(
            context,
            ref,
            systemKey: 'team:${team.id}',
            title: team.name,
          ),
        ),
      if (messagingLive)
        TeamQuickActionChip(
          icon: ViroIcons.users,
          label: copy.parentsChatShort,
          accent: accent,
          onTap: () => _openSystemChat(
            context,
            ref,
            systemKey: 'parents:${team.id}',
            title: AppCopy.chat.parentsOfTeamLabel(team.name),
          ),
        ),
      if (onInvite != null)
        TeamQuickActionChip(
          icon: ViroIcons.userPlus,
          label: copy.inviteShort,
          accent: accent,
          onTap: onInvite!,
        ),
      if (showStandings && team.federation != null)
        TeamQuickActionChip(
          icon: ViroIcons.trophyOutline,
          label: AppCopy.standings.openStandings,
          accent: accent,
          onTap: () => context.push(
            AppRoutes.clubTeamStandingsPath(team.clubId, team.id),
          ),
        ),
    ];

    if (actions.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: ViroSpacing.sm),
      child: SizedBox(
        width: double.infinity,
        child: Wrap(
          alignment: WrapAlignment.center,
          spacing: ViroSpacing.sm,
          runSpacing: ViroSpacing.sm,
          children: actions,
        ),
      ),
    );
  }
}

/// Pastille teintée couleur club (icône + libellé court).
class TeamQuickActionChip extends StatelessWidget {
  const TeamQuickActionChip({
    super.key,
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
    final palette = context.viroPalette;
    final accentText = palette.readableAccent(accent);
    final style = ClubAccentStyle(accent);
    final radius = BorderRadius.circular(ViroSpacing.minTouchTarget / 2);

    return ViroPressable(
      floating: false,
      borderRadius: radius,
      onTap: onTap,
      child: Container(
        constraints:
            const BoxConstraints(minHeight: ViroSpacing.minTouchTarget),
        padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.md - 2),
        decoration: BoxDecoration(
          color: style.surfaceTint,
          borderRadius: radius,
          border: Border.all(color: style.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ViroIcon(icon, size: 18, color: accentText),
            const SizedBox(width: ViroSpacing.xs + 2),
            Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: accentText,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
