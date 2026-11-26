import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_motion.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_rank_badge.dart';

/// Option d'une barre de choix du classement.
class StandingsSwitcherOption {
  const StandingsSwitcherOption({
    required this.label,
    required this.color,
    required this.selected,
    required this.semanticLabel,
    required this.onTap,
    this.detail,
    this.rank,
  });

  final String label;

  /// Complément discret après le libellé (prénoms des enfants suivis).
  final String? detail;

  /// Couleur du club de l'option.
  final Color color;
  final bool selected;

  /// Position au classement (badge), équipes seulement.
  final int? rank;
  final String semanticLabel;
  final VoidCallback onTap;
}

/// Dimensions des barres de choix.
abstract final class _Bar {
  static const double tabHeight = ViroSpacing.minTouchTarget;
  static const double tabPadding = ViroSpacing.md - 2;
  static const double dot = 8;
  static const double underline = 3;
  static const double trackPadding = 3;
  static const double trackRadius = 14;
  static const double segmentRadius = trackRadius - trackPadding;
  static const double segmentPadding = ViroSpacing.md - 4;
  static const double badge = 20;
  static const double gap = 6;
}

/// Onglets de club (menu d'app) : pastille couleur du club + nom, trait
/// souligné à la couleur du club sous l'onglet choisi. Remplissent la
/// largeur quand ils tiennent, défilent sinon.
class StandingsClubTabs extends StatelessWidget {
  const StandingsClubTabs({super.key, required this.options});

  final List<StandingsSwitcherOption> options;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final style = _labelStyle(context, selected: true);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: palette.border)),
      ),
      child: _AdaptiveRow(
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.screenHorizontal - _Bar.tabPadding / 2,
        ),
        naturalWidths: [
          for (final option in options)
            _textWidth(context, _fullLabel(option), style) +
                _Bar.dot +
                _Bar.gap +
                2 * _Bar.tabPadding,
        ],
        children: [for (final option in options) _ClubTab(option: option)],
      ),
    );
  }
}

class _ClubTab extends StatelessWidget {
  const _ClubTab({required this.option});

  final StandingsSwitcherOption option;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final readable = palette.readableAccent(option.color);
    final style = _labelStyle(context, selected: option.selected);
    return Semantics(
      selected: option.selected,
      child: ViroPressable(
        onTap: option.selected ? null : option.onTap,
        label: option.semanticLabel,
        floating: false,
        child: SizedBox(
          height: _Bar.tabHeight,
          child: Stack(
            children: [
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: _Bar.tabPadding,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: _Bar.dot,
                        height: _Bar.dot,
                        decoration: BoxDecoration(
                          color: readable,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: _Bar.gap),
                      Flexible(
                        child: _OptionLabel(
                          option: option,
                          style: style?.copyWith(
                            color: option.selected
                                ? readable
                                : palette.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Positioned(
                left: _Bar.tabPadding,
                right: _Bar.tabPadding,
                bottom: 0,
                child: AnimatedContainer(
                  duration: ViroMotion.fast,
                  height: _Bar.underline,
                  decoration: BoxDecoration(
                    color: option.selected ? readable : Colors.transparent,
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(_Bar.underline),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Sélecteur segmenté des équipes : rail neutre, équipe choisie en carte
/// surélevée à la couleur du club, badge de rang à droite du nom. Les
/// segments se partagent la largeur quand ils tiennent, défilent sinon.
class StandingsTeamSegments extends StatelessWidget {
  const StandingsTeamSegments({super.key, required this.options});

  final List<StandingsSwitcherOption> options;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final style = _labelStyle(context, selected: true);
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ViroSpacing.screenHorizontal,
      ),
      child: Container(
        padding: const EdgeInsets.all(_Bar.trackPadding),
        decoration: BoxDecoration(
          color: palette.surfaceMuted,
          borderRadius: BorderRadius.circular(_Bar.trackRadius),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(_Bar.segmentRadius),
          child: _AdaptiveRow(
            naturalWidths: [
              for (final option in options)
                _textWidth(context, _fullLabel(option), style) +
                    (option.rank == null ? 0 : _Bar.gap + _Bar.badge) +
                    2 * _Bar.segmentPadding,
            ],
            children: [
              for (final option in options) _TeamSegment(option: option),
            ],
          ),
        ),
      ),
    );
  }
}

class _TeamSegment extends StatelessWidget {
  const _TeamSegment({required this.option});

  final StandingsSwitcherOption option;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final readable = palette.readableAccent(option.color);
    final radius = BorderRadius.circular(_Bar.segmentRadius);
    return Semantics(
      selected: option.selected,
      child: ViroPressable(
        onTap: option.selected ? null : option.onTap,
        label: option.semanticLabel,
        borderRadius: radius,
        floating: false,
        child: AnimatedContainer(
          duration: ViroMotion.fast,
          padding: const EdgeInsets.symmetric(horizontal: _Bar.segmentPadding),
          decoration: BoxDecoration(
            color: option.selected ? palette.surfaceCard : Colors.transparent,
            borderRadius: radius,
            boxShadow: option.selected ? ViroMotion.cardShadow(palette) : null,
          ),
          // `min` : en défilement, la largeur reçue est non bornée.
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: _OptionLabel(
                  option: option,
                  style: _labelStyle(context, selected: option.selected)
                      ?.copyWith(
                        color: option.selected
                            ? readable
                            : palette.textSecondary,
                      ),
                ),
              ),
              if (option.rank != null) ...[
                const SizedBox(width: _Bar.gap),
                ViroRankBadge(
                  rank: option.rank!,
                  clubColor: option.color,
                  size: _Bar.badge,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Libellé + complément discret (enfants), sur une ligne.
class _OptionLabel extends StatelessWidget {
  const _OptionLabel({required this.option, required this.style});

  final StandingsSwitcherOption option;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Text.rich(
      TextSpan(
        text: option.label,
        children: [
          if (option.detail != null)
            TextSpan(
              text: ' · ${option.detail}',
              style: TextStyle(
                fontWeight: FontWeight.w500,
                color: palette.textMuted,
              ),
            ),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: style,
    );
  }
}

/// Rangée qui partage la largeur entre ses enfants si leurs largeurs
/// naturelles ([naturalWidths]) tiennent, et défile horizontalement sinon.
class _AdaptiveRow extends StatelessWidget {
  const _AdaptiveRow({
    required this.children,
    required this.naturalWidths,
    this.padding = EdgeInsets.zero,
  });

  final List<Widget> children;
  final List<double> naturalWidths;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final needed = naturalWidths.fold<double>(0, (sum, w) => sum + w);
        final fits = needed <= constraints.maxWidth - padding.horizontal;
        if (fits) {
          return Padding(
            padding: padding,
            child: Row(
              children: [for (final child in children) Expanded(child: child)],
            ),
          );
        }
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: padding,
          child: Row(children: children),
        );
      },
    );
  }
}

String _fullLabel(StandingsSwitcherOption option) =>
    option.detail == null ? option.label : '${option.label} · ${option.detail}';

TextStyle? _labelStyle(BuildContext context, {required bool selected}) =>
    Theme.of(context).textTheme.labelLarge?.copyWith(
      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
    );

/// Largeur d'affichage de [text] (échelle de texte comprise), pour décider
/// entre partage de la largeur et défilement.
double _textWidth(BuildContext context, String text, TextStyle? style) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: Directionality.of(context),
    textScaler: MediaQuery.textScalerOf(context),
    maxLines: 1,
  )..layout();
  final width = painter.width;
  painter.dispose();
  return width + 1;
}
