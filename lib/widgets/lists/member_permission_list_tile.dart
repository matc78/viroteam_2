import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_glyphs.dart';
import 'package:viro_team_v2/config/viro_haptics.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_selection.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_selection_mark.dart';

/// Carte sélectionnable de la feuille d'attribution des droits : un droit ou
/// une fonction (groupe de droits), avec son icône sur mesure.
///
/// [value] `null` = état partiel (fonction dont une partie des droits est
/// cochée) ; un tap complète alors la fonction. [onChanged] `null` = carte
/// en lecture seule (droit déjà donné par l'Administrateur, enregistrement
/// en cours). [compact] : icône au-dessus du titre, sans sous-titre visible
/// (grille des fonctions) ; le sous-titre reste lu par le lecteur d'écran.
/// [onLockedTap] : action d'un tap sur une carte en lecture seule (ex.
/// proposer d'aller régler la capacité ailleurs).
class MemberPermissionListTile extends StatelessWidget {
  const MemberPermissionListTile({
    super.key,
    required this.title,
    required this.value,
    required this.onChanged,
    this.subtitle,
    this.accentColor,
    this.glyph,
    this.compact = false,
    this.onLockedTap,
  });

  final String title;
  final String? subtitle;
  final bool? value;
  final ValueChanged<bool>? onChanged;
  final Color? accentColor;
  final ViroGlyph? glyph;
  final bool compact;
  final VoidCallback? onLockedTap;

  void _toggle() {
    ViroHaptics.selection();
    // Partiel → coché : un tap complète la fonction.
    onChanged?.call(value != true);
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final textTheme = Theme.of(context).textTheme;
    final accent = ViroSelection.accentOf(context, accentColor);
    final readableAccent = ViroSelection.readableAccentOf(context, accent);
    final full = value == true;
    final partial = value == null;
    final enabled = onChanged != null;
    final radius = BorderRadius.circular(ViroSpacing.cardRadius);

    final borderColor = full
        ? accent
        : partial
        ? accent.withValues(alpha: 0.55)
        : palette.border;
    final glyphFill = full
        ? accent
        : partial
        ? ViroSelection.tintOf(accent)
        : palette.surfaceSubtle;
    final glyphColor = full
        ? palette.onAccent
        : partial
        ? readableAccent
        : palette.textSecondary;

    final mark = ViroSelectionMark(
      value: value,
      color: accent,
      enabled: enabled,
    );
    final glyphTile = glyph == null
        ? null
        : AnimatedContainer(
            duration: ViroSelection.fillDuration,
            curve: ViroSelection.fillCurve,
            width: ViroSelection.glyphTileSize,
            height: ViroSelection.glyphTileSize,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: glyphFill,
              borderRadius: BorderRadius.circular(
                ViroSelection.glyphTileRadius,
              ),
            ),
            child: ViroGlyphIcon(
              glyph!,
              size: ViroSelection.glyphSize,
              color: glyphColor,
            ),
          );
    final titleText = Text(
      title,
      maxLines: compact ? 2 : null,
      overflow: compact ? TextOverflow.ellipsis : null,
      style: (compact ? textTheme.bodySmall : textTheme.bodyMedium)?.copyWith(
        fontWeight: FontWeight.w600,
        color: palette.textPrimary,
        height: 1.25,
      ),
    );

    final Widget content;
    if (compact) {
      content = Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ?glyphTile,
              const SizedBox(height: ViroSpacing.sm),
              Padding(
                padding: const EdgeInsets.only(right: ViroSpacing.xs),
                child: titleText,
              ),
            ],
          ),
          Positioned(top: 0, right: 0, child: mark),
        ],
      );
    } else {
      content = Row(
        children: [
          if (glyphTile != null) ...[
            glyphTile,
            const SizedBox(width: ViroSpacing.md),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                titleText,
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: textTheme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: ViroSpacing.md),
          mark,
        ],
      );
    }

    final interactive = enabled || onLockedTap != null;
    return MergeSemantics(
      child: Semantics(
        checked: value ?? false,
        mixed: partial,
        enabled: interactive,
        hint: compact ? subtitle : null,
        child: ViroPressable(
          onTap: enabled ? _toggle : onLockedTap,
          enabled: interactive,
          floating: false,
          borderRadius: radius,
          child: AnimatedContainer(
            duration: ViroSelection.fillDuration,
            curve: ViroSelection.fillCurve,
            padding: const EdgeInsets.all(ViroSelection.cardPadding),
            decoration: BoxDecoration(
              color: full ? ViroSelection.tintOf(accent) : palette.surfaceCard,
              borderRadius: radius,
              border: Border.all(
                color: borderColor,
                width: ViroSelection.cardBorderWidth,
              ),
            ),
            child: content,
          ),
        ),
      ),
    );
  }
}
