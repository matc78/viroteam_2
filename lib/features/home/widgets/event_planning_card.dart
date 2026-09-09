import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/planning/widgets/planning_rsvp_badge.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/utils/date_format_fr.dart';
import 'package:viro_team_v2/widgets/common/club_chip.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Tuile planning : tap → détail ; RSVP via icônes check / croix / attente.
class EventPlanningCard extends StatelessWidget {
  const EventPlanningCard({
    super.key,
    required this.event,
    required this.clubName,
    required this.clubColor,
    this.clubColorSecondary,
    required this.coachView,
    this.teamRsvpCounts,
    this.rsvpStatus,
    this.onTap,
    this.onLongPress,
    this.onRsvpSelected,
  });

  final ClubEvent event;
  final String clubName;
  final Color clubColor;
  final Color? clubColorSecondary;

  /// Legacy : compteurs agrégés seuls (home membre utilise toujours le RSVP perso).
  final bool coachView;

  /// Compteurs équipe (présents / absents / en attente).
  final ({int yes, int no, int none})? teamRsvpCounts;

  /// RSVP personnel (joueur convoqué ou coach de l'événement).
  final RsvpStatus? rsvpStatus;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// Callback RSVP ; `null` masque le sélecteur d’icônes.
  final ValueChanged<RsvpStatus>? onRsvpSelected;

  IconData get _typeIcon => switch (event.type) {
        EventTypes.training => ViroIcons.whistle,
        EventTypes.match => ViroIcons.ball,
        EventTypes.tournament => ViroIcons.trophy,
        _ => ViroIcons.calendar,
      };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final typeLabel = eventTypeLabel(event.type);
    final title = event.title.trim();
    final showTitle = title.isNotEmpty && title != typeLabel;
    final timeStr = formatEventTime(event.startTime);
    final location = event.location?.trim();
    final scheduleParts = [
      if (timeStr.isNotEmpty) timeStr,
      if (location != null && location.isNotEmpty) location,
    ];

    final showPlayerRsvp = !coachView && onRsvpSelected != null;

    return ViroCard(
      onTap: onTap,
      onLongPress: onLongPress,
      accentColor: clubColor,
      accentColorSecondary: clubColorSecondary,
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.md,
        vertical: ViroSpacing.sm + 2,
      ),
      margin: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ViroIcon(_typeIcon, size: 18, color: clubColor),
              const SizedBox(width: ViroSpacing.xs),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: typeLabel,
                        style: theme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: clubColor,
                          height: 1.2,
                        ),
                      ),
                      if (showTitle)
                        TextSpan(
                          text: ' · $title',
                          style: theme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: ViroColors.primary800,
                            height: 1.2,
                          ),
                        ),
                    ],
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: ViroSpacing.xs),
              ClubChip(label: clubName, color: clubColor),
            ],
          ),
          if (scheduleParts.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              scheduleParts.join(' · '),
              style: theme.bodySmall?.copyWith(
                color: ViroColors.gray600,
                height: 1.2,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (showPlayerRsvp) ...[
            const SizedBox(height: ViroSpacing.xs),
            _buildMemberRsvpFooter(),
          ],
          if (coachView && teamRsvpCounts != null) ...[
            const SizedBox(height: ViroSpacing.xs),
            _buildCoachRsvpFooter(),
          ],
        ],
      ),
    );
  }

  Widget _buildMemberRsvpFooter() {
    final counts = teamRsvpCounts ?? (yes: 0, no: 0, none: 0);
    return Align(
      alignment: Alignment.centerRight,
      child: PlanningRsvpCountChoiceRow(
        counts: counts,
        status: rsvpStatus ?? RsvpStatus.none,
        onSelected: onRsvpSelected!,
      ),
    );
  }

  Widget _buildCoachRsvpFooter() {
    return Center(child: PlanningRsvpSummaryRow(counts: teamRsvpCounts!));
  }
}
