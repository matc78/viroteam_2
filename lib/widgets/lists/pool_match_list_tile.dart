import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/services/standings/pool_team_season.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Match du parcours d'une équipe de la poule : journée, date, domicile /
/// extérieur, adversaire, salle, puis score (joué) ou heure (à venir).
class PoolMatchListTile extends StatelessWidget {
  const PoolMatchListTile({super.key, required this.match, this.onTap});

  final PoolTeamMatch match;

  /// Tap sur l'adversaire (ouvre sa saison).
  final VoidCallback? onTap;

  static final _dateFormat = DateFormat('dd/MM', 'fr_FR');

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.standings;
    final date = match.date;
    final venueLabel = match.isHome ? copy.homeShort : copy.awayShort;
    final opponent = displayPoolTeamName(match.opponentName);
    final details = <String>[
      if (match.isPlayed && match.sets.isNotEmpty) match.sets.join(', '),
      if (match.forfeit) copy.forfeit,
      if (match.venue != null) displayPoolTeamName(match.venue!),
    ];

    final Widget trailing;
    if (match.isPlayed) {
      final color = match.isWin ? ViroColors.success : ViroColors.error;
      trailing = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '${match.us}-${match.them}',
            style: theme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: palette.textPrimary,
            ),
          ),
          const SizedBox(width: ViroSpacing.xs),
          ViroIcon(
            match.isWin ? ViroIcons.checkCircle : ViroIcons.xCircle,
            size: 18,
            color: color,
            semanticLabel: match.isWin ? copy.winShort : copy.lossShort,
          ),
        ],
      );
    } else {
      trailing = Text(
        match.time ?? '',
        style: theme.titleSmall?.copyWith(
          fontWeight: FontWeight.w700,
          color: palette.textPrimary,
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.xs),
      child: ViroCard(
        onTap: onTap,
        elevated: false,
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm,
        ),
        child: Row(
          children: [
            SizedBox(
              width: 48,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text(
                    copy.roundShort(match.round),
                    textAlign: TextAlign.center,
                    style: theme.labelSmall?.copyWith(
                      color: palette.textMuted,
                    ),
                  ),
                  Text(
                    date == null ? '–' : _dateFormat.format(date),
                    textAlign: TextAlign.center,
                    style: theme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: palette.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text(
                    '$venueLabel · ${copy.versus(opponent)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: theme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: palette.textPrimary,
                    ),
                  ),
                  if (details.isNotEmpty)
                    Text(
                      details.join(' · '),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: theme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: ViroSpacing.sm),
            trailing,
          ],
        ),
      ),
    );
  }
}
