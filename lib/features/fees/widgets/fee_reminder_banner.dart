import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/fees/providers/fee_providers.dart';
import 'package:viro_team_v2/features/fees/utils/fee_format.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/club_chip.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

class FeeReminderBanner extends ConsumerWidget {
  const FeeReminderBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final itemsAsync = ref.watch(homeFeeRemindersProvider);

    return itemsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (error, stackTrace) => const SizedBox.shrink(),
      data: (items) {
        if (items.isEmpty) return const SizedBox.shrink();

        return Padding(
          padding: const EdgeInsets.fromLTRB(
            ViroSpacing.screenHorizontal,
            ViroSpacing.sm,
            ViroSpacing.screenHorizontal,
            0,
          ),
          child: Column(
            children: [
              for (final item in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
                  child: _FeeReminderCard(
                    item: item,
                    onTap: () => context.push(
                      AppRoutes.clubMyFeePath(item.clubId),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _FeeReminderCard extends StatefulWidget {
  const _FeeReminderCard({
    required this.item,
    required this.onTap,
  });

  final HomeFeeReminderItem item;
  final VoidCallback onTap;

  @override
  State<_FeeReminderCard> createState() => _FeeReminderCardState();
}

class _FeeReminderCardState extends State<_FeeReminderCard>
    with SingleTickerProviderStateMixin {
  AnimationController? _pulseController;
  Animation<double>? _pulseAnimation;

  HomeFeeReminderItem get item => widget.item;

  bool get _shouldPulse => item.isUrgent;

  void _syncPulseAnimation() {
    if (_shouldPulse && _pulseController == null) {
      _pulseController = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 1200),
      )..repeat(reverse: true);
      _pulseAnimation = Tween<double>(begin: 0.35, end: 1.0).animate(
        CurvedAnimation(parent: _pulseController!, curve: Curves.easeInOut),
      );
    } else if (!_shouldPulse && _pulseController != null) {
      _pulseController!.dispose();
      _pulseController = null;
      _pulseAnimation = null;
    }
  }

  @override
  void initState() {
    super.initState();
    _syncPulseAnimation();
  }

  @override
  void didUpdateWidget(covariant _FeeReminderCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncPulseAnimation();
  }

  @override
  void dispose() {
    _pulseController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final accent = clubAccentColor(
      brandColorHex: item.brandColorHex,
      clubId: item.clubId,
    );
    final isOverdue = item.isOverdue;
    final isDeadlineToday = item.isFeeDeadlineUrgentDay;
    final isUrgent = item.isUrgent;
    final statusColor = isUrgent ? ViroColors.error : accent;

    final amount = formatFeeAmountCents(item.fee.amountDueCents(item.season));
    final deadline = item.season.paymentDeadlineAt;
    final deadlineText = deadline != null
        ? DateFormat.yMMMMd('fr_FR').format(deadline)
        : null;

    Widget card(Color borderColor) => DecoratedBox(
      decoration: BoxDecoration(
        color: isDeadlineToday
            ? Color.lerp(ViroColors.white, ViroColors.error, 0.08)
            : ViroColors.white,
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        border: Border.all(color: borderColor, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: ViroColors.gray900.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ViroPressable(
        onTap: widget.onTap,
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        child: Padding(
          padding: const EdgeInsets.all(ViroSpacing.md),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: (isUrgent ? ViroColors.error : accent)
                      .withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: ViroIcon(
                  ViroIcons.payments,
                  color: isUrgent ? ViroColors.error : accent,
                  size: 22,
                ),
              ),
              const SizedBox(width: ViroSpacing.sm + ViroSpacing.xs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            'Cotisation ${item.season.seasonLabel}',
                            style: theme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: accent,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: ViroSpacing.sm),
                        ClubChip(label: item.clubName, color: accent),
                      ],
                    ),
                    const SizedBox(height: ViroSpacing.xs),
                    Row(
                      children: [
                        Text(
                          amount,
                          style: theme.bodyLarge?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: isUrgent ? ViroColors.error : accent,
                          ),
                        ),
                        const SizedBox(width: ViroSpacing.xs),
                        if (isOverdue)
                          _StatusBadge(
                            label: 'En retard',
                            color: ViroColors.error,
                          )
                        else if (isDeadlineToday)
                          _StatusBadge(
                            label: 'Échéance aujourd\'hui',
                            color: ViroColors.error,
                          )
                        else
                          Text(
                            'à régler',
                            style: theme.bodyMedium?.copyWith(
                              color: ViroColors.gray400,
                            ),
                          ),
                      ],
                    ),
                    if (!isUrgent && deadlineText != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        'avant le $deadlineText',
                        style: theme.bodySmall?.copyWith(
                          color: ViroColors.gray400,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: ViroSpacing.xs),
              ViroIcon(
                ViroIcons.chevronRight,
                color: ViroColors.gray300,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );

    final pulse = _pulseAnimation;
    if (isUrgent && pulse != null) {
      return AnimatedBuilder(
        animation: pulse,
        builder: (context, _) => card(
          ViroColors.error.withValues(alpha: pulse.value),
        ),
      );
    }

    return card(statusColor);
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
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
