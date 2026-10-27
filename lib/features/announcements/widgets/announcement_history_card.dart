import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_announcement.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Carte d'une annonce dans l'écran de gestion des annonces du club.
///
/// Une annonce inactive (clôturée ou expirée) est atténuée et porte un badge
/// de statut ; le menu ⋮ n'apparaît que si [canManage].
class AnnouncementHistoryCard extends StatelessWidget {
  const AnnouncementHistoryCard({
    super.key,
    required this.announcement,
    required this.targetLabel,
    required this.accentColor,
    required this.canManage,
    required this.onTap,
    required this.onEdit,
    required this.onDelete,
    this.onClose,
  });

  final ClubAnnouncement announcement;
  final String targetLabel;
  final Color accentColor;
  final bool canManage;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  /// Clôture de l'annonce ; `null` masque l'entrée (annonce déjà inactive).
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final isActive = announcement.isActive;
    final cardAccent = isActive ? accentColor : palette.textMuted;
    final readableAccent = palette.readableAccent(cardAccent);

    return ViroCard(
      onTap: onTap,
      accentColor: isActive ? accentColor : null,
      borderColor: isActive ? ClubAccentStyle(accentColor).border : null,
      elevated: isActive,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ViroIcon(ViroIcons.bell, size: 16, color: readableAccent),
              const SizedBox(width: ViroSpacing.xs),
              Expanded(
                child: Text(
                  announcement.authorName,
                  style: theme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: readableAccent,
                  ),
                ),
              ),
              Text(
                formatRelativeDate(announcement.createdAt),
                style: theme.bodySmall?.copyWith(color: palette.textMuted),
              ),
              if (canManage)
                PopupMenuButton<String>(
                  tooltip: AppCopy.announcements.moreActionsTooltip,
                  icon: ViroIcon(ViroIcons.moreVertical, size: 20),
                  onSelected: (value) {
                    switch (value) {
                      case 'edit':
                        onEdit();
                      case 'close':
                        onClose?.call();
                      case 'delete':
                        onDelete();
                    }
                  },
                  itemBuilder: (_) => [
                    PopupMenuItem(
                      value: 'edit',
                      child: Text(AppCopy.common.edit),
                    ),
                    if (onClose != null)
                      PopupMenuItem(
                        value: 'close',
                        child: Text(AppCopy.announcements.closeAction),
                      ),
                    PopupMenuItem(
                      value: 'delete',
                      child: Text(
                        AppCopy.common.delete,
                        style: TextStyle(color: palette.errorText),
                      ),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: ViroSpacing.xs),
          Wrap(
            spacing: ViroSpacing.xs,
            runSpacing: ViroSpacing.xs,
            children: [
              _AnnouncementPill(
                label: targetLabel,
                color: readableAccent,
                background: cardAccent.withValues(alpha: 0.12),
              ),
              if (!isActive)
                _AnnouncementPill(
                  label: announcement.closedAt != null
                      ? AppCopy.announcements.closedBadge
                      : AppCopy.announcements.expiredBadge,
                  color: palette.textSecondary,
                  background: palette.textMuted.withValues(alpha: 0.16),
                ),
            ],
          ),
          if (announcement.endsAt != null) ...[
            const SizedBox(height: ViroSpacing.xs),
            Text(
              AppCopy.announcements.untilDate(
                DateFormat(
                  'd MMM yyyy HH:mm',
                  'fr_FR',
                ).format(announcement.endsAt!),
              ),
              style: theme.bodySmall?.copyWith(color: palette.textSecondary),
            ),
          ],
          const SizedBox(height: ViroSpacing.sm),
          Text(
            announcement.message,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: theme.bodyMedium?.copyWith(
              color: isActive ? null : palette.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Pastille compacte (cible, statut) de la carte d'annonce.
class _AnnouncementPill extends StatelessWidget {
  const _AnnouncementPill({
    required this.label,
    required this.color,
    required this.background,
  });

  final String label;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.sm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
