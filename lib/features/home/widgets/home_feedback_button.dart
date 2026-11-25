import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:viro_team_v2/config/feature_flags.dart';
import 'package:viro_team_v2/config/routes.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/training/providers/training_providers.dart';

/// Icône « Feedback » de l'app bar de la home (à côté de la coupe) : pastille
/// bleue à gauche = retours à faire (coach), rouge à droite = retours reçus
/// pas encore lus. Ouvre la page Feedback sur la partie concernée.
/// Invisible si le compte ne gère ni ne reçoit de retours.
class HomeFeedbackButton extends ConsumerWidget {
  const HomeFeedbackButton({super.key});

  static const double _badgeSize = 16;

  /// Débord des pastilles au-dessus et sur les côtés de l'icône.
  static const double _badgeOverflowTop = -5;
  static const double _badgeOverflowSide = -7;
  static const double _badgeFontSize = 10;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!FeatureFlags.trainingToolsLive) return const SizedBox.shrink();
    final visible =
        ref.watch(trainingFeedbackCanManageProvider) ||
        ref.watch(trainingFeedbackCanReceiveProvider);
    if (!visible) return const SizedBox.shrink();
    final unseen = ref.watch(unseenTrainingFeedbackCountProvider);
    final pending = ref.watch(pendingTrainingFeedbackTotalProvider);
    final palette = context.viroPalette;
    final tab = unseen > 0
        ? TrainingFeedbackHubTab.mine
        : pending > 0
        ? TrainingFeedbackHubTab.manage
        : null;

    return IconButton(
      tooltip: AppCopy.training.hubButtonTooltip(
        unseen: unseen,
        pending: pending,
      ),
      onPressed: () =>
          context.push(AppRoutes.trainingFeedbackHubPath(tab: tab)),
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          ViroIcon(
            ViroIcons.feedback,
            shadows: palette.neonGlow(palette.accent),
          ),
          // Bleu à gauche : retours à faire (coach).
          if (pending > 0)
            Positioned(
              top: _badgeOverflowTop,
              left: _badgeOverflowSide,
              child: _CountBadge(count: pending, color: palette.accentFill),
            ),
          // Rouge à droite : retours reçus pas encore lus.
          if (unseen > 0)
            Positioned(
              top: _badgeOverflowTop,
              right: _badgeOverflowSide,
              child: _CountBadge(count: unseen, color: ViroColors.error),
            ),
        ],
      ),
    );
  }
}

/// Pastille compteur de l'icône Feedback.
class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count, required this.color});

  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return ExcludeSemantics(
      child: Container(
        constraints: const BoxConstraints(
          minWidth: HomeFeedbackButton._badgeSize,
          minHeight: HomeFeedbackButton._badgeSize,
        ),
        padding: const EdgeInsets.symmetric(horizontal: ViroSpacing.xs),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(
            HomeFeedbackButton._badgeSize / 2,
          ),
          boxShadow: ViroMotion.floatingShadow(
            palette,
            opacity: 0.18,
            blur: 8,
            y: 2,
          ),
        ),
        child: Text(
          count > 9 ? '9+' : '$count',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: ViroColors.white,
            fontSize: HomeFeedbackButton._badgeFontSize,
            fontWeight: FontWeight.w800,
            height: 1.2,
          ),
        ),
      ),
    );
  }
}
