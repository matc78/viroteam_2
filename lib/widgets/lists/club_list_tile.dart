import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_membership_summary.dart';
import 'package:viro_team_v2/utils/club_color.dart';
import 'package:viro_team_v2/utils/sport_emoji.dart';
import 'package:viro_team_v2/widgets/common/viro_card.dart';
import 'package:viro_team_v2/widgets/common/viro_role_badge.dart';

class ClubListTile extends StatelessWidget {
  const ClubListTile({
    super.key,
    required this.club,
    this.membership,
    required this.onTap,
    this.accentColor,
  });

  final Club club;
  final ClubMembershipSummary? membership;
  final VoidCallback onTap;
  final Color? accentColor;

  ViroRole? get _badgeRole => membership == null
      ? null
      : viroRoleFromMemberRole(membership!.role);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final accent = accentColor ??
        resolveClubBrandColors(
          brandColorHex: club.brandColorHex,
          clubId: club.id,
        ).memberZoneColor;
    final subtitle = [
      club.sport,
      if (club.city != null && club.city!.isNotEmpty) club.city,
    ].join(' · ');

    return Padding(
      padding: const EdgeInsets.only(bottom: ViroSpacing.md),
      child: ViroCard(
        onTap: onTap,
        accentColor: accent,
        borderColor: ClubAccentStyle(accent).border,
        child: Row(
          children: [
            _ClubAvatar(
              logoUrl: club.logoUrl,
              sport: club.sport,
              accentColor: accent,
            ),
            const SizedBox(width: ViroSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    club.name,
                    style: theme.titleMedium?.copyWith(
                      color: accent,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: theme.bodySmall?.copyWith(
                      color: ViroColors.gray600,
                    ),
                  ),
                ],
              ),
            ),
            if (_badgeRole != null)
              ViroRoleBadge(role: _badgeRole!, compact: true),
          ],
        ),
      ),
    );
  }
}

class _ClubAvatar extends StatelessWidget {
  const _ClubAvatar({
    required this.logoUrl,
    required this.sport,
    required this.accentColor,
  });

  final String? logoUrl;
  final String sport;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final trimmedLogo = logoUrl?.trim();
    final hasLogo = trimmedLogo != null && trimmedLogo.isNotEmpty;

    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accentColor.withValues(alpha: 0.35)),
        image: hasLogo
            ? DecorationImage(
                image: NetworkImage(trimmedLogo),
                fit: BoxFit.cover,
              )
            : null,
      ),
      alignment: Alignment.center,
      child: hasLogo
          ? null
          : Text(
              sportEmoji(sport),
              style: const TextStyle(fontSize: 24),
            ),
    );
  }
}
