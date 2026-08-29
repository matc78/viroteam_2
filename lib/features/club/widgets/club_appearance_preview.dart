import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/features/club/widgets/bicolor_circle.dart';
import 'package:viro_team_v2/features/club/widgets/club_context_avatar.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/utils/club_color.dart';

/// Aperçu statique (non cliquable) de l'identité visuelle club.
class ClubAppearancePreview extends StatelessWidget {
  const ClubAppearancePreview({
    super.key,
    required this.club,
    required this.brandColors,
    this.logoPreviewBytes,
  });

  final Club club;
  final ClubBrandColors brandColors;
  final Uint8List? logoPreviewBytes;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final memberStyle = ClubAccentStyle(brandColors.memberZoneColor);
    final managementStyle =
        ClubAccentStyle(brandColors.managementZoneColor);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: ViroColors.surfaceCard,
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
        border: Border.all(color: memberStyle.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(ViroSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Aperçu',
              style: theme.labelMedium?.copyWith(
                color: ViroColors.gray600,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: ViroSpacing.md),
            Center(
              child: ClubContextAvatar(
                club: club,
                accentColor: brandColors.primary,
                logoPreviewBytes: logoPreviewBytes,
                size: 64,
                borderRadius: 16,
              ),
            ),
            if (brandColors.isBicolor) ...[
              const SizedBox(height: ViroSpacing.md),
              BicolorCircle(
                primary: brandColors.primary,
                secondary: brandColors.secondary,
                size: 28,
              ),
            ],
            const SizedBox(height: ViroSpacing.lg),
            _ZonePreview(
              title: 'Accès rapides',
              subtitle: 'Planning, équipes…',
              accent: brandColors.memberZoneColor,
              accentStyle: memberStyle,
              icon: ViroIcons.calendar,
            ),
            if (brandColors.isBicolor) ...[
              const SizedBox(height: ViroSpacing.sm),
              _ZonePreview(
                title: 'Gestion du club',
                subtitle: 'Membres, équipes, apparence…',
                accent: brandColors.managementZoneColor,
                accentStyle: managementStyle,
                icon: ViroIcons.settings,
              ),
            ] else ...[
              const SizedBox(height: ViroSpacing.sm),
              Text(
                'Couleur unique sur toutes les sections.',
                textAlign: TextAlign.center,
                style: theme.bodySmall?.copyWith(color: ViroColors.gray600),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ZonePreview extends StatelessWidget {
  const _ZonePreview({
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.accentStyle,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final Color accent;
  final ClubAccentStyle accentStyle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: accentStyle.surfaceTint,
        borderRadius: BorderRadius.circular(ViroSpacing.cardRadius - 2),
        border: Border.all(color: accentStyle.border),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: ViroSpacing.md,
          vertical: ViroSpacing.sm,
        ),
        child: Row(
          children: [
            Container(
              width: 3,
              height: 36,
              decoration: BoxDecoration(
                color: accent,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: ViroSpacing.sm),
            ViroIcon(icon, size: 20, color: accent),
            const SizedBox(width: ViroSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: accent,
                    ),
                  ),
                  Text(
                    subtitle,
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
