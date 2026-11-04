import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_chat.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_palette.dart';
import 'package:viro_team_v2/widgets/common/viro_image_lightbox.dart';

/// Avatar circulaire d’une conversation : canal (mégaphone), groupe (photo ou
/// icône), DM (photo du pair ou initiale teintée de la couleur du club).
///
/// Tap : [onTap] s’il est fourni ; sinon une photo s’ouvre en grand (avec
/// [onEdit] dans la visionneuse), et sans photo [onEdit] est appelé.
/// [heroTag] partage l’avatar entre l’inbox et l’en-tête du fil.
class ViroConversationAvatar extends StatelessWidget {
  const ViroConversationAvatar({
    super.key,
    required this.size,
    required this.color,
    required this.groupBackground,
    this.initial = '?',
    this.photoUrl,
    this.isGroup = false,
    this.isChannel = false,
    this.heroTag,
    this.onTap,
    this.onEdit,
    this.showEditBadge = false,
  });

  /// Diamètre (voir les tailles `ViroChat.avatar*`).
  final double size;

  /// Couleur du club (initiale d’un DM).
  final Color color;

  /// Fond d’un groupe ou d’un canal (`colorForConversationGroupAvatarTone`).
  final Color groupBackground;
  final String initial;
  final String? photoUrl;
  final bool isGroup;
  final bool isChannel;
  final String? heroTag;
  final VoidCallback? onTap;
  final VoidCallback? onEdit;

  /// Pastille appareil photo en bas à droite (photo modifiable).
  final bool showEditBadge;

  @override
  Widget build(BuildContext context) {
    final trimmedPhoto = photoUrl?.trim();
    final hasPhoto =
        !isChannel && trimmedPhoto != null && trimmedPhoto.isNotEmpty;

    Widget avatar = SizedBox.square(
      dimension: size,
      child: hasPhoto
          ? ClipOval(
              child: Image.network(
                trimmedPhoto,
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _fallback(),
              ),
            )
          : _fallback(),
    );

    final tag = heroTag;
    if (tag != null) {
      avatar = Hero(
        tag: tag,
        child: Material(color: Colors.transparent, child: avatar),
      );
    }

    if (showEditBadge) {
      avatar = Stack(
        alignment: Alignment.bottomRight,
        children: [avatar, const _EditBadge()],
      );
    }

    final VoidCallback? handleTap = onTap ??
        (hasPhoto
            ? () => showViroImageLightbox(
                  context,
                  imageUrl: trimmedPhoto,
                  onEdit: onEdit,
                  shape: ViroImageLightboxShape.circle,
                )
            : onEdit);
    if (handleTap == null) return avatar;
    return GestureDetector(onTap: handleTap, child: avatar);
  }

  Widget _fallback() {
    if (isChannel || isGroup) {
      return _IconAvatar(
        size: size,
        background: groupBackground,
        icon: isChannel ? ViroIcons.megaphone : ViroIcons.groups,
      );
    }
    return _InitialAvatar(initial: initial, color: color, size: size);
  }
}

/// Pastille groupe / canal : icône blanche sur fond de ton.
class _IconAvatar extends StatelessWidget {
  const _IconAvatar({
    required this.size,
    required this.background,
    required this.icon,
  });

  final double size;
  final Color background;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: background, shape: BoxShape.circle),
      child: ViroIcon(
        icon,
        size: size * ViroChat.avatarIconRatio,
        color: ViroColors.white,
      ),
    );
  }
}

/// Initiale d’un DM sans photo, sur la couleur du club adoucie.
class _InitialAvatar extends StatelessWidget {
  const _InitialAvatar({
    required this.initial,
    required this.color,
    required this.size,
  });

  final String initial;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Color.lerp(palette.surfaceCard, color, 0.35),
        shape: BoxShape.circle,
      ),
      child: Text(
        initial,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: palette.readableAccent(color),
              fontWeight: FontWeight.w800,
              fontSize: size * ViroChat.avatarInitialRatio,
            ),
      ),
    );
  }
}

/// Pastille appareil photo « modifier la photo ».
class _EditBadge extends StatelessWidget {
  const _EditBadge();

  @override
  Widget build(BuildContext context) {
    final palette = context.viroPalette;
    return Container(
      width: 28,
      height: 28,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: palette.accentFill,
        shape: BoxShape.circle,
      ),
      child: ViroIcon(ViroIcons.camera, size: 14, color: palette.onAccent),
    );
  }
}
