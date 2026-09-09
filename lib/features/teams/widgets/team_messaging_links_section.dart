import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/teams/widgets/edit_team_messaging_links_sheet.dart';
import 'package:viro_team_v2/models/club_team.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Bloc des liens de discussion d'équipe, affiché au-dessus du roster.
class TeamMessagingLinksSection extends StatelessWidget {
  const TeamMessagingLinksSection({
    super.key,
    required this.team,
    required this.accent,
    required this.canEdit,
  });

  final ClubTeam team;
  final Color accent;
  final bool canEdit;

  bool get _hasTeamLink =>
      team.messagingLink != null && team.messagingLink!.isNotEmpty;

  bool get _hasParentsLink =>
      team.parentsMessagingLink != null &&
      team.parentsMessagingLink!.isNotEmpty;

  bool get _hasAnyLink => _hasTeamLink || _hasParentsLink;

  Future<void> _openLink(BuildContext context, String url) async {
    final uri = Uri.tryParse(url.trim());
    if (uri == null) {
      ViroSnackBar.show(context, 'Lien invalide');
      return;
    }
    final launched = await launchUrl(
      uri,
      mode: LaunchMode.externalApplication,
    );
    if (!launched && context.mounted) {
      ViroSnackBar.show(context, 'Impossible d\'ouvrir le lien');
    }
  }

  Future<void> _openEditSheet(BuildContext context) {
    return showEditTeamMessagingLinksSheet(context, team: team);
  }

  @override
  Widget build(BuildContext context) {
    if (!_hasAnyLink && !canEdit) {
      return const SizedBox.shrink();
    }

    final theme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.only(top: ViroSpacing.sm, bottom: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'DISCUSSIONS',
                  style: theme.labelSmall?.copyWith(
                    color: accent,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                  ),
                ),
              ),
              if (canEdit && _hasAnyLink)
                ViroPressable(
                  floating: false,
                  borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
                  onTap: () => _openEditSheet(context),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: ViroSpacing.xs,
                      vertical: 2,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ViroIcon(ViroIcons.edit, size: 16, color: accent),
                        const SizedBox(width: 4),
                        Text(
                          'Modifier',
                          style: theme.labelSmall?.copyWith(
                            color: accent,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          if (!_hasAnyLink && canEdit)
            ViroPressable(
              floating: false,
              borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius),
              onTap: () => _openEditSheet(context),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  vertical: ViroSpacing.sm,
                  horizontal: ViroSpacing.xs,
                ),
                child: Row(
                  children: [
                    ViroIcon(ViroIcons.whatsapp, size: 22, color: accent),
                    const SizedBox(width: ViroSpacing.md),
                    Expanded(
                      child: Text(
                        'Ajouter les liens WhatsApp',
                        style: theme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: ViroColors.primary800,
                        ),
                      ),
                    ),
                    ViroIcon(
                      ViroIcons.add,
                      size: 18,
                      color: ViroColors.gray400,
                    ),
                  ],
                ),
              ),
            )
          else ...[
            if (_hasTeamLink)
              _MessagingLinkTile(
                icon: ViroIcons.whatsapp,
                label: 'Groupe équipe',
                accent: accent,
                onTap: () => _openLink(context, team.messagingLink!),
              ),
            if (_hasParentsLink)
              _MessagingLinkTile(
                icon: ViroIcons.chat,
                label: 'Groupe parents',
                accent: accent,
                onTap: () => _openLink(context, team.parentsMessagingLink!),
              ),
          ],
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
