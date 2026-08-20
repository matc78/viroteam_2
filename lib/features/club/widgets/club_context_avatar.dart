import 'package:flutter/material.dart';
import 'package:viro_team_v2/features/members/widgets/member_avatar.dart';
import 'package:viro_team_v2/models/club.dart';
import 'package:viro_team_v2/models/club_member.dart';

/// Avatar contextuel : enfant suivi en mode parent, sinon logo / initiale club.
class ClubContextAvatar extends StatelessWidget {
  const ClubContextAvatar({
    super.key,
    required this.club,
    required this.accentColor,
    this.childMember,
    this.size = 44,
    this.borderRadius = 8,
  });

  final Club club;
  final Color accentColor;
  final ClubMember? childMember;
  final double size;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    if (childMember != null) {
      return MemberAvatar(member: childMember!, size: size);
    }

    final initial = club.name.isNotEmpty ? club.name[0].toUpperCase() : '?';
    final logoUrl = club.logoUrl;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(borderRadius),
        border: borderRadius >= size / 2
            ? Border.all(color: accentColor, width: 1.5)
            : null,
        image: logoUrl != null
            ? DecorationImage(
                image: NetworkImage(logoUrl),
                fit: BoxFit.cover,
              )
            : null,
      ),
      alignment: Alignment.center,
      child: logoUrl == null
          ? Text(
              initial,
              style: TextStyle(
                color: accentColor,
                fontWeight: FontWeight.w700,
                fontSize: size * 0.4,
              ),
            )
          : null,
    );
  }
}
