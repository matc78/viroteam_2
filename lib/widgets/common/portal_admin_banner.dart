import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/portal_links.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Bannière admin renvoyant vers le portail web pour le pilotage bureau.
class PortalAdminBanner extends StatelessWidget {
  const PortalAdminBanner({
    super.key,
    required this.portalUrl,
    required this.message,
    this.compact = false,
    this.ctaLabel = 'Ouvrir l\'espace club',
    this.accentColor,
    this.onDismiss,
  });

  final Uri portalUrl;
  final String message;
  final bool compact;
  final String ctaLabel;
  final Color? accentColor;
  final VoidCallback? onDismiss;

  Future<void> _openPortal() => openPortalUrl(portalUrl);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final accent = accentColor ?? ViroColors.primary600;
    final accentStyle = ClubAccentStyle(accent);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ViroSpacing.screenHorizontal,
        ViroSpacing.sm,
        ViroSpacing.screenHorizontal,
        ViroSpacing.sm,
      ),
      child: ViroCard(
        margin: EdgeInsets.zero,
        accentColor: accentColor,
        borderColor: accentStyle.border,
        padding: EdgeInsets.all(compact ? ViroSpacing.sm : ViroSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ViroIcon(
                  ViroIcons.roleAdmin,
                  size: compact ? 18 : 20,
                  color: accent,
                ),
                const SizedBox(width: ViroSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Pilotage complet sur le portail',
                        style: (compact
                                ? theme.labelLarge
                                : theme.titleSmall)
                            ?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: ViroColors.primary800,
                        ),
                      ),
                      const SizedBox(height: ViroSpacing.xs),
                      Text(
                        message,
                        style: theme.bodySmall?.copyWith(
                          color: ViroColors.gray600,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                if (onDismiss != null)
                  IconButton(
                    icon: ViroIcon(
                      ViroIcons.close,
                      size: 16,
                      color: ViroColors.gray400,
                    ),
                    onPressed: onDismiss,
                    tooltip: 'Masquer',
                    padding: EdgeInsets.zero,
                    constraints:
                        const BoxConstraints(minWidth: 32, minHeight: 32),
                  ),
              ],
            ),
            if (!compact) const SizedBox(height: ViroSpacing.sm),
            Align(
              alignment: Alignment.centerRight,
              child: ViroPressable(
                onTap: _openPortal,
                borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ViroSpacing.sm,
                    vertical: ViroSpacing.xs,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        ctaLabel,
                        style: theme.labelLarge?.copyWith(
                          color: accent,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: ViroSpacing.xs),
                      ViroIcon(
                        ViroIcons.chevronRight,
                        size: 16,
                        color: accent,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
