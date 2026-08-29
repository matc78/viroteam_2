import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/announcements/widgets/announcement_message_sheet.dart';
import 'package:viro_team_v2/models/club_announcement.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

class AnnouncementPreview extends StatelessWidget {
  const AnnouncementPreview({
    super.key,
    required this.announcement,
    this.accentColor,
  });

  final ClubAnnouncement announcement;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final accentStyle =
        accentColor != null ? ClubAccentStyle(accentColor!) : null;

    return ViroCard(
      onTap: () => showAnnouncementMessageSheet(
        context,
        announcement: announcement,
      ),
      accentColor: accentColor,
      borderColor: accentStyle?.border,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (accentColor != null) ...[
                ViroIcon(ViroIcons.bell, size: 16, color: accentColor),
                const SizedBox(width: ViroSpacing.xs),
              ],
              Expanded(
                child: Text(
                  announcement.authorName,
                  style: theme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: accentColor ?? ViroColors.primary800,
                  ),
                ),
              ),
              Text(
                formatRelativeDate(announcement.createdAt),
                style: theme.bodySmall?.copyWith(color: ViroColors.gray400),
              ),
            ],
          ),
          const SizedBox(height: ViroSpacing.sm),
          Text(
            announcement.message,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.bodyMedium,
          ),
        ],
      ),
    );
  }
}
