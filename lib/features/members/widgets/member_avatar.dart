import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/copy/app_copy.dart';
import 'package:viro_team_v2/models/club_member.dart';
import 'package:viro_team_v2/widgets/common/viro_image_lightbox.dart';

/// Avatar membre : photo / initiales / icône ; tap pour zoomer si photo.
class MemberAvatar extends StatelessWidget {
  const MemberAvatar({
    super.key,
    required this.member,
    this.size = 44,
    this.accentColor,
    this.showAccentBorder = false,
    this.onEdit,
  });

  final ClubMember member;
  final double size;
  final Color? accentColor;

  /// Bordure couleur club (ex. avatar contextuel parent dans un sélecteur).
  final bool showAccentBorder;

  /// Si fourni, le lightbox affiche un bouton « Modifier ».
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final hasAccount = member.hasLinkedAccount;
    final photoUrl = member.avatarUrl?.trim();
    final hasPhoto =
        hasAccount && photoUrl != null && photoUrl.isNotEmpty;

    final accent = accentColor ?? ViroColors.primary600;
    final accentBorder = showAccentBorder
        ? Border.all(color: accent, width: 1.5)
        : null;

    final Widget avatar;
    if (hasPhoto) {
      avatar = Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: accentBorder,
          image: DecorationImage(
            image: NetworkImage(photoUrl),
            fit: BoxFit.cover,
          ),
        ),
      );
    } else if (hasAccount) {
      avatar = Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: accent.withValues(alpha: 0.15),
          border: accentBorder,
        ),
        alignment: Alignment.center,
        child: Text(
          member.initials,
          style: TextStyle(
            color: accent,
            fontWeight: FontWeight.w700,
            fontSize: size * 0.35,
          ),
        ),
      );
    } else {
      avatar = Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: ViroColors.gray100,
          border: accentBorder ??
              Border.all(color: ViroColors.gray300, width: 1.5),
        ),
        alignment: Alignment.center,
        child: ViroIcon(
          ViroIcons.user,
          size: size * 0.45,
          color: ViroColors.gray600,
        ),
      );
    }

    if (!hasPhoto) return avatar;

    return GestureDetector(
      onTap: () {
        showViroImageLightbox(
          context,
          imageUrl: photoUrl,
          semanticLabel: AppCopy.members.enlargePhoto(member.fullName),
          onEdit: onEdit,
          shape: ViroImageLightboxShape.circle,
        );
      },
      child: Semantics(
        button: true,
        label: AppCopy.members.enlargePhoto(member.fullName),
        child: avatar,
      ),
    );
  }
}
