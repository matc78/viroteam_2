import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/utils/sport_emoji.dart';
import 'package:viro_team_v2/widgets/common/viro_image_lightbox.dart';

/// Avatar contextuel : enfant suivi en mode parent, sinon logo / emoji sport.
class ClubContextAvatar extends StatelessWidget {
  const ClubContextAvatar({
    super.key,
    required this.club,
    required this.accentColor,
    this.childMember,
    this.logoPreviewBytes,
    this.size = 44,
    this.borderRadius = 8,
    this.onEdit,
    this.enableZoom = true,
  });

  final Club club;
  final Color accentColor;
  final ClubMember? childMember;
  final Uint8List? logoPreviewBytes;
  final double size;
  final double borderRadius;

  /// Si fourni, le lightbox affiche un bouton « Modifier ».
  final VoidCallback? onEdit;

  /// Tap pour agrandir le logo (défaut true).
  final bool enableZoom;

  @override
  Widget build(BuildContext context) {
    if (childMember != null) {
      return MemberAvatar(
        member: childMember!,
        size: size,
        accentColor: accentColor,
        showAccentBorder: borderRadius >= size / 2,
        onEdit: onEdit,
      );
    }

    final logoUrl = club.logoUrl?.trim();
    final hasPreview = logoPreviewBytes != null && logoPreviewBytes!.isNotEmpty;
    final hasLogo = hasPreview ||
        (logoUrl != null && logoUrl.isNotEmpty);

    final avatar = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(borderRadius),
        border: borderRadius >= size / 2
            ? Border.all(color: accentColor, width: 1.5)
            : null,
        image: hasLogo
            ? DecorationImage(
                image: hasPreview
                    ? MemoryImage(logoPreviewBytes!) as ImageProvider
                    : NetworkImage(logoUrl!),
                fit: BoxFit.cover,
              )
            : null,
      ),
      alignment: Alignment.center,
      child: hasLogo
          ? null
          : Text(
              sportEmoji(club.sport),
              style: TextStyle(fontSize: size * 0.48),
            ),
    );

    if (!hasLogo) {
      if (onEdit == null) return avatar;
      return GestureDetector(onTap: onEdit, child: avatar);
    }

    if (!enableZoom) return avatar;

    return GestureDetector(
      onTap: () {
        showViroImageLightbox(
          context,
          imageUrl: hasPreview ? null : logoUrl,
          imageBytes: hasPreview ? logoPreviewBytes : null,
          onEdit: onEdit,
          shape: ViroImageLightboxShape.rounded,
        );
      },
      child: avatar,
    );
  }
}
