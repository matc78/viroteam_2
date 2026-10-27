import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/features/club/widgets/club_context_avatar.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

/// Chiffre clé affiché en pastille sous le nom du club.
class ClubHeroStat {
  const ClubHeroStat({required this.icon, required this.label, this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
}

/// En-tête de la fiche club : bandeau teinté aux couleurs du club, logo,
/// nom, sport / ville, badge de rôle et chiffres clés (centrés, compacts).
///
/// [onEditAppearance] (admin) rend le bloc identité tappables vers
/// l’apparence du club — sans icône crayon ; les chips restent hors geste.
class ClubHeroHeader extends StatelessWidget {
  const ClubHeroHeader({
    super.key,
    required this.club,
    required this.accent,
    this.accentSecondary,
    this.role,
    this.stats = const [],
    this.onEditAppearance,
  });

  final Club club;
  final Color accent;
  final Color? accentSecondary;
  final String? role;
  final List<ClubHeroStat> stats;
  final VoidCallback? onEditAppearance;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final palette = context.viroPalette;
    final style = ClubAccentStyle(accent, secondary: accentSecondary);
    final radius = BorderRadius.circular(ViroSpacing.cardRadius);
    final meta = [
      club.sport,
      if (club.city != null && club.city!.isNotEmpty) club.city!,
    ].join(' · ');

    final identity = Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        ClubContextAvatar(
          club: club,
          accentColor: accent,
          size: 56,
          borderRadius: 14,
        ),
        const SizedBox(height: ViroSpacing.sm),
        Text(
          club.name,
          textAlign: TextAlign.center,
          style: theme.titleMedium?.copyWith(
            color: palette.brandText,
            fontWeight: FontWeight.w800,
          ),
        ),
        if (meta.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            meta,
            textAlign: TextAlign.center,
            style: theme.bodySmall?.copyWith(
              color: palette.textSecondary,
            ),
          ),
        ],
        if (role != null) ...[
          const SizedBox(height: ViroSpacing.sm - 2),
          ViroRoleBadge(
            role: viroRoleFromMemberRole(role!),
            compact: true,
          ),
        ],
      ],
    );

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.sm,
        ViroSpacing.screenHorizontal,
        0,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: radius,
          border: Border.all(color: style.border),
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [
              accent.withValues(alpha: 0.18),
              (accentSecondary ?? accent).withValues(alpha: 0.05),
            ],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: ViroSpacing.md,
            vertical: ViroSpacing.sm + 2,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (onEditAppearance != null)
                ViroPressable(
                  onTap: onEditAppearance,
                  borderRadius: radius,
                  label: AppCopy.club.actionAppearance,
                  child: identity,
                )
              else
                identity,
              if (stats.isNotEmpty) ...[
                const SizedBox(height: ViroSpacing.md - 2),
                Wrap(
                  alignment: WrapAlignment.center,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: ViroSpacing.xs + 2,
                  runSpacing: ViroSpacing.xs,
                  children: [
                    for (final stat in stats)
                      _HeroStatChip(stat: stat, accent: accent),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Pastille d’info dynamique — volontairement plus petite que [ViroRoleBadge]
/// compact (hauteur ~22 vs 28).
class _HeroStatChip extends StatelessWidget {
  const _HeroStatChip({required this.stat, required this.accent});

  final ClubHeroStat stat;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    final radius = BorderRadius.circular(999);
    final foreground = palette.readableAccent(accent);

    final chip = DecoratedBox(
      decoration: BoxDecoration(
        color: palette.surfaceCard.withValues(alpha: 0.75),
        borderRadius: radius,
        border: Border.all(color: ClubAccentStyle(accent).border),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.sm,
          vertical: 3,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ViroIcon(stat.icon, size: 12, color: foreground),
            const SizedBox(width: ViroSpacing.xs),
            Text(
              stat.label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: palette.textSecondary,
                    fontWeight: FontWeight.w600,
                    height: 1.1,
                  ),
            ),
            if (stat.onTap != null) ...[
              const SizedBox(width: 2),
              ViroIcon(
                ViroIcons.chevronRight,
                size: 11,
                color: palette.textMuted,
              ),
            ],
          ],
        ),
      ),
    );

    if (stat.onTap == null) return chip;
    // minSize 0 : pastille visuelle compacte (pas la cible 44 px).
    return ViroPressable(
      onTap: stat.onTap,
      borderRadius: radius,
      label: stat.label,
      minSize: 0,
      floating: false,
      child: chip,
    );
  }
}
