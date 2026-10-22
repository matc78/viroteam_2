import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/models/club_event.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Badge icône + compteur (résumé ou choix RSVP).
class PlanningRsvpCountBadge extends StatelessWidget {
  const PlanningRsvpCountBadge({
    super.key,
    required this.icon,
    required this.count,
    required this.color,
    this.onTap,
    this.selected = false,
    this.semanticLabel,
  });

  final IconData icon;
  final int count;
  final Color color;
  final VoidCallback? onTap;
  final bool selected;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final badge = Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: color.withValues(alpha: selected ? 0.22 : 0.12),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: selected ? color : Colors.transparent,
              width: 1.5,
            ),
          ),
          alignment: Alignment.center,
          child: ViroIcon(icon, size: 18, color: color),
        ),
        if (count > 0)
          Positioned(
            right: -5,
            top: -5,
            child: Container(
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.xs),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: context.viroPalette.surfaceCard,
                  width: 1.5,
                ),
              ),
              alignment: Alignment.center,
              child: Text(
                count > 99 ? '99+' : '$count',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: ViroColors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 10,
                      height: 1,
                    ),
              ),
            ),
          ),
      ],
    );

    final hitTarget = ConstrainedBox(
      constraints: const BoxConstraints(
        minWidth: ViroSpacing.minTouchTarget,
        minHeight: ViroSpacing.minTouchTarget,
      ),
      child: Center(child: badge),
    );

    if (onTap == null) {
      if (semanticLabel == null) return hitTarget;
      return Semantics(label: semanticLabel, child: hitTarget);
    }

    return Semantics(
      button: true,
      selected: selected,
      label: semanticLabel,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: hitTarget,
      ),
    );
  }
}

/// Badge RSVP d'un joueur (icône seule).
class PlanningRsvpStatusBadge extends StatelessWidget {
  const PlanningRsvpStatusBadge({super.key, required this.status});

  final RsvpStatus status;

  (IconData icon, Color color, String label) get _style => switch (status) {
        RsvpStatus.yes => (
            ViroIcons.check,
            ViroColors.success,
            AppCopy.planning.rsvpPresent,
          ),
        RsvpStatus.maybe => (
            ViroIcons.clock,
            ViroColors.warning,
            AppCopy.planning.rsvpPending,
          ),
        RsvpStatus.no => (
            ViroIcons.close,
            ViroColors.error,
            AppCopy.planning.rsvpAbsent,
          ),
        RsvpStatus.none => (
            ViroIcons.clock,
            ViroColors.warning,
            AppCopy.planning.rsvpPending,
          ),
      };

  @override
  Widget build(BuildContext context) {
    final (icon, color, label) = _style;
    return Semantics(
      label: label,
      child: Container(
        width: ViroSpacing.minTouchTarget,
        height: ViroSpacing.minTouchTarget,
        alignment: Alignment.center,
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          alignment: Alignment.center,
          child: ViroIcon(icon, size: 18, color: color),
        ),
      ),
    );
  }
}

/// Compteurs équipe cliquables pour choisir son RSVP (pastilles conservées).
class PlanningRsvpCountChoiceRow extends StatelessWidget {
  const PlanningRsvpCountChoiceRow({
    super.key,
    required this.counts,
    required this.status,
    required this.onSelected,
  });

  final ({int yes, int no, int none}) counts;
  final RsvpStatus status;
  final ValueChanged<RsvpStatus> onSelected;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        PlanningRsvpCountBadge(
          icon: ViroIcons.check,
          count: counts.yes,
          color: ViroColors.success,
          selected: status == RsvpStatus.yes,
          semanticLabel: AppCopy.planning.rsvpCountLabel(
            AppCopy.planning.rsvpPresent,
            counts.yes,
          ),
          onTap: () => onSelected(RsvpStatus.yes),
        ),
        const SizedBox(width: ViroSpacing.sm),
        PlanningRsvpCountBadge(
          icon: ViroIcons.close,
          count: counts.no,
          color: ViroColors.error,
          selected: status == RsvpStatus.no,
          semanticLabel: AppCopy.planning.rsvpCountLabel(
            AppCopy.planning.rsvpAbsent,
            counts.no,
          ),
          onTap: () => onSelected(RsvpStatus.no),
        ),
        const SizedBox(width: ViroSpacing.sm),
        PlanningRsvpCountBadge(
          icon: ViroIcons.clock,
          count: counts.none,
          color: ViroColors.warning,
          selected: status == RsvpStatus.none || status == RsvpStatus.maybe,
          semanticLabel: AppCopy.planning.rsvpCountLabel(
            AppCopy.planning.rsvpPending,
            counts.none,
          ),
          onTap: () => onSelected(RsvpStatus.none),
        ),
      ],
    );
  }
}

/// Rangée résumé des compteurs RSVP (lecture seule, labels accessibles).
class PlanningRsvpSummaryRow extends StatelessWidget {
  const PlanningRsvpSummaryRow({super.key, required this.counts});

  final ({int yes, int no, int none}) counts;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        PlanningRsvpCountBadge(
          icon: ViroIcons.check,
          count: counts.yes,
          color: ViroColors.success,
          semanticLabel: AppCopy.planning.rsvpCountLabel(
            AppCopy.planning.rsvpPresent,
            counts.yes,
          ),
        ),
        const SizedBox(width: ViroSpacing.sm),
        PlanningRsvpCountBadge(
          icon: ViroIcons.close,
          count: counts.no,
          color: ViroColors.error,
          semanticLabel: AppCopy.planning.rsvpCountLabel(
            AppCopy.planning.rsvpAbsent,
            counts.no,
          ),
        ),
        if (counts.none > 0) ...[
          const SizedBox(width: ViroSpacing.sm),
          PlanningRsvpCountBadge(
            icon: ViroIcons.clock,
            count: counts.none,
            color: ViroColors.warning,
            semanticLabel: AppCopy.planning.rsvpCountLabel(
              AppCopy.planning.rsvpPending,
              counts.none,
            ),
          ),
        ],
      ],
    );
  }
}
