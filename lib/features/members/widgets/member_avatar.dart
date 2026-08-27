import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/models/club_member.dart';

/// Avatar membre : photo / initiales / icône ; tap pour zoomer si photo.
class MemberAvatar extends StatelessWidget {
  const MemberAvatar({
    super.key,
    required this.member,
    this.size = 44,
  });

  final ClubMember member;
  final double size;

  @override
  Widget build(BuildContext context) {
    final hasAccount = member.hasLinkedAccount;
    final photoUrl = member.avatarUrl?.trim();
    final hasPhoto =
        hasAccount && photoUrl != null && photoUrl.isNotEmpty;

    final Widget avatar;
    if (hasPhoto) {
      avatar = CircleAvatar(
        radius: size / 2,
        backgroundImage: NetworkImage(photoUrl),
      );
    } else if (hasAccount) {
      avatar = CircleAvatar(
        radius: size / 2,
        backgroundColor: ViroColors.primary100,
        child: Text(
          member.initials,
          style: TextStyle(
            color: ViroColors.primary800,
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
          border: Border.all(color: ViroColors.gray300, width: 1.5),
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
      onTap: () => _showZoom(context, photoUrl),
      child: Semantics(
        button: true,
        label: 'Agrandir la photo de ${member.fullName}',
        child: avatar,
      ),
    );
  }

  void _showZoom(BuildContext context, String photoUrl) {
    showDialog<void>(
      context: context,
      barrierColor: ViroColors.primary900.withValues(alpha: 0.72),
      builder: (dialogContext) {
        return GestureDetector(
          onTap: () => Navigator.of(dialogContext).pop(),
          behavior: HitTestBehavior.opaque,
          child: Stack(
            children: [
              Center(
                child: GestureDetector(
                  onTap: () {},
                  child: ClipOval(
                    child: Image.network(
                      photoUrl,
                      width: 280,
                      height: 280,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => Container(
                        width: 280,
                        height: 280,
                        color: ViroColors.gray200,
                        alignment: Alignment.center,
                        child: ViroIcon(
                          ViroIcons.user,
                          size: 64,
                          color: ViroColors.gray600,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                top: MediaQuery.paddingOf(dialogContext).top + 12,
                right: 16,
                child: IconButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  icon: ViroIcon(
                    ViroIcons.close,
                    color: ViroColors.white,
                    size: 22,
                  ),
                  style: IconButton.styleFrom(
                    backgroundColor: ViroColors.white.withValues(alpha: 0.18),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
