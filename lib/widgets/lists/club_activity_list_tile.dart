import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/models/club_activity_event.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Tuile d’une entrée du journal d’activité club.
class ClubActivityListTile extends StatelessWidget {
  const ClubActivityListTile({
    super.key,
    required this.event,
    this.accentColor,
  });

  final ClubActivityEvent event;
  final Color? accentColor;

  static final _dateFormat = DateFormat('dd MMM yyyy · HH:mm', 'fr_FR');

  IconData get _icon {
    switch (event.type) {
      case ClubActivityTypes.membersAdded:
      case ClubActivityTypes.membersRemoved:
        return ViroIcons.user;
      case ClubActivityTypes.invitationsSent:
        return ViroIcons.envelope;
      case ClubActivityTypes.eventsCreated:
      case ClubActivityTypes.eventCancelled:
        return ViroIcons.calendar;
      case ClubActivityTypes.teamCreated:
        return ViroIcons.users;
      case ClubActivityTypes.announcementPublished:
        return ViroIcons.bell;
      default:
        return ViroIcons.clock;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final accent = accentColor ?? ViroColors.primary600;

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        accentColor: accent,
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ViroIcon(_icon, size: 22, color: accent),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.displayTitle,
                    style: theme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: accent,
                    ),
                  ),
                  if (event.displayDetail != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      event.displayDetail!,
                      style: theme.bodySmall?.copyWith(
                        color: ViroColors.gray600,
                      ),
                    ),
                  ],
                  const SizedBox(height: 2),
                  Text(
                    AppCopy.activity.byActor(event.actorDisplayName),
                    style: theme.bodySmall?.copyWith(
                      color: ViroColors.gray600,
                    ),
                  ),
                  Text(
                    _dateFormat.format(event.createdAt),
                    style: theme.bodySmall?.copyWith(
                      color: ViroColors.gray600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
