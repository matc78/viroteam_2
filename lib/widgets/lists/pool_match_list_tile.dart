import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/services/standings/pool_team_season.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';

/// Match du parcours d'une équipe de la poule : bloc journée / date,
/// adversaire, pastille Domicile / Extérieur et sets colorés, puis score
/// (vert / rouge, joué) ou heure (à venir). La carte est liserée de la
/// couleur du résultat. Pas d'adresse : le côté du terrain suffit.
class PoolMatchListTile extends StatelessWidget {
  const PoolMatchListTile({
    super.key,
    required this.match,
    this.accentColor,
    this.onTap,
  });

  final PoolTeamMatch match;

  /// Couleur du club (matchs à venir) ; accent du thème par défaut.
  final Color? accentColor;

  /// Tap sur l'adversaire (ouvre sa saison).
  final VoidCallback? onTap;

  static final _dateFormat = DateFormat('dd/MM', 'fr_FR');

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    final copy = AppCopy.standings;
    final date = match.date;
    final opponent = displayPoolTeamName(match.opponentName);
    final tone = match.isPlayed
        ? (match.isWin ? ViroColors.success : ViroColors.error)
        : palette.readableAccent(accentColor ?? palette.accent);
    final score = match.isPlayed ? '${match.us}-${match.them}' : null;

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.sm),
      child: ViroCard(
        onTap: onTap,
        elevated: false,
        margin: EdgeInsets.zero,
        borderColor: tone.withValues(alpha: palette.isDark ? 0.45 : 0.3),
        padding: EdgeInsets.zero,
        semanticLabel: copy.matchSemantics(
          round: match.round,
          opponent: opponent,
          isHome: match.isHome,
          outcome: score ?? match.time,
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 4, color: tone),
              const SizedBox(width: ViroSpacing.sm + 2),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: ViroSpacing.sm),
                child: _DateBlock(
                  round: copy.roundShort(match.round),
                  date: date == null ? '–' : _dateFormat.format(date),
                  tone: tone,
                ),
              ),
              const SizedBox(width: ViroSpacing.sm + 2),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: ViroSpacing.sm + 2,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        opponent,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: palette.textPrimary,
                        ),
                      ),
                      const SizedBox(height: ViroSpacing.xs + 2),
                      Wrap(
                        spacing: ViroSpacing.xs,
                        runSpacing: ViroSpacing.xs,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          _SideChip(isHome: match.isHome),
                          if (match.forfeit)
                            _SetChip(label: copy.forfeit, won: match.isWin),
                          if (match.isPlayed)
                            for (final set in match.sets)
                              _SetChip(label: set, won: _isSetWon(set)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: ViroSpacing.sm),
              Center(
                child: score != null
                    ? _ScoreBadge(score: score, color: tone)
                    : _TimeBadge(time: match.time, tone: tone),
              ),
              const SizedBox(width: ViroSpacing.md - 4),
            ],
          ),
        ),
      ),
    );
  }

  /// Set « équipe-adversaire » gagné par l'équipe (`null` si illisible).
  static bool? _isSetWon(String set) {
    final parts = set.split('-');
    if (parts.length != 2) return null;
    final us = int.tryParse(parts[0].trim());
    final them = int.tryParse(parts[1].trim());
    if (us == null || them == null) return null;
    return us > them;
  }
}

/// Bloc journée + date, teinté de la couleur du résultat.
class _DateBlock extends StatelessWidget {
  const _DateBlock({
    required this.round,
    required this.date,
    required this.tone,
  });

  final String round;
  final String date;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final theme = Theme.of(context).textTheme;
    return Container(
      width: 52,
      padding: const EdgeInsets.symmetric(vertical: ViroSpacing.xs + 2),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: palette.isDark ? 0.18 : 0.1),
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius + 2),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            round,
            textAlign: TextAlign.center,
            style: theme.labelSmall?.copyWith(
              color: tone,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            date,
            textAlign: TextAlign.center,
            style: theme.bodySmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: palette.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Pastille Domicile (accent) / Extérieur (orange), avec icône.
class _SideChip extends StatelessWidget {
  const _SideChip({required this.isHome});

  final bool isHome;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final copy = AppCopy.standings;
    final color = isHome
        ? palette.readableAccent(palette.accent)
        : palette.readableAccent(ViroColors.sportOrange);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: palette.isDark ? 0.2 : 0.12),
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ViroIcon(
            isHome ? ViroIcons.homeGame : ViroIcons.awayGame,
            size: 12,
            color: color,
          ),
          const SizedBox(width: 3),
          Text(
            isHome ? copy.homeLabel : copy.awayLabel,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// Score d'un set : vert si gagné, rouge si perdu, neutre si illisible.
class _SetChip extends StatelessWidget {
  const _SetChip({required this.label, required this.won});

  final String label;
  final bool? won;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final color = switch (won) {
      true => palette.successText,
      false => palette.errorText,
      null => palette.textSecondary,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: palette.surfaceSubtle,
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius - 2),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w600,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );
  }
}

/// Score final en pastille pleine (vert victoire, rouge défaite).
class _ScoreBadge extends StatelessWidget {
  const _ScoreBadge({required this.score, required this.color});

  final String score;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.sm + 2,
        vertical: ViroSpacing.xs + 2,
      ),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius + 2),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.35),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        score,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
          color: ViroColors.white,
          fontWeight: FontWeight.w900,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );
  }
}

/// Heure d'un match à venir, en pastille douce couleur club.
class _TimeBadge extends StatelessWidget {
  const _TimeBadge({required this.time, required this.tone});

  final String? time;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final label = time;
    if (label == null || label.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.sm,
        vertical: ViroSpacing.xs + 1,
      ),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: palette.isDark ? 0.2 : 0.1),
        borderRadius: BorderRadius.circular(ViroSpacing.buttonRadius + 2),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ViroIcon(ViroIcons.clock, size: 14, color: tone),
          const SizedBox(width: ViroSpacing.xs),
          Text(
            label,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: tone,
              fontWeight: FontWeight.w800,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
