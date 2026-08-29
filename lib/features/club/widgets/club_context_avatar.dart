import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/utils/sport_emoji.dart';

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
  });

  final Club club;
  final Color accentColor;
  final ClubMember? childMember;
  final Uint8List? logoPreviewBytes;
  final double size;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    if (childMember != null) {
      return MemberAvatar(member: childMember!, size: size);
    }

    final logoUrl = club.logoUrl?.trim();
    final hasPreview = logoPreviewBytes != null && logoPreviewBytes!.isNotEmpty;
    final hasLogo = hasPreview ||
        (logoUrl != null && logoUrl.isNotEmpty);

    return Container(
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
  }
}
