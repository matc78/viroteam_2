import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/models/viro_user.dart';
import 'package:viro_team_v2/providers/service_providers.dart';
import 'package:viro_team_v2/providers/session_provider.dart';
import 'package:viro_team_v2/utils/viro_snackbar.dart';
import 'package:viro_team_v2/widgets/common/viro_pressable.dart';

/// Sélectionne une photo et met à jour l’avatar utilisateur.
Future<bool> pickAndUploadUserAvatar(
  BuildContext context,
  WidgetRef ref, {
  required ViroUser user,
}) async {
  final picker = ImagePicker();
  final file = await picker.pickImage(
    source: ImageSource.gallery,
    maxWidth: 512,
    maxHeight: 512,
    imageQuality: 85,
  );
  if (file == null || !context.mounted) return false;

  try {
    final bytes = await file.readAsBytes();
    final contentType = _contentTypeFromPath(file.path);
    final avatarUrl = await ref.read(userAvatarStorageProvider).uploadAvatar(
          uid: user.uid,
          bytes: bytes,
          contentType: contentType,
        );
    final activeClubId = ref.read(sessionProvider).activeClubId;
    await ref.read(userServiceProvider).updateAvatarUrl(
          uid: user.uid,
          avatarUrl: avatarUrl,
          syncMemberClubId: activeClubId,
        );
    if (context.mounted) {
      ViroSnackBar.show(context, 'Avatar mis à jour');
    }
    return true;
  } catch (_) {
    if (context.mounted) {
      ViroSnackBar.show(context, 'Upload avatar impossible');
    }
    return false;
  }
}

String _contentTypeFromPath(String path) {
  final lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/// Avatar utilisateur avec initiales ou photo réseau.
class UserSettingsAvatar extends StatelessWidget {
  const UserSettingsAvatar({
    super.key,
    required this.displayName,
    this.avatarUrl,
    this.onTap,
    this.busy = false,
  });

  final String displayName;
  final String? avatarUrl;
  final VoidCallback? onTap;
  final bool busy;

  String get _initials {
    final parts = displayName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    return parts
        .take(2)
        .map((part) => part[0].toUpperCase())
        .join();
  }

  @override
  Widget build(BuildContext context) {
    final trimmedUrl = avatarUrl?.trim();
    final hasPhoto = trimmedUrl != null && trimmedUrl.isNotEmpty;

    Widget avatar = CircleAvatar(
      radius: 32,
      backgroundColor: ViroColors.primary100,
      backgroundImage: hasPhoto ? NetworkImage(trimmedUrl) : null,
      child: hasPhoto
          ? null
          : Text(
              _initials.isNotEmpty ? _initials : '?',
              style: const TextStyle(
                color: ViroColors.primary800,
                fontWeight: FontWeight.w700,
                fontSize: 18,
              ),
            ),
    );

    if (busy) {
      avatar = Stack(
        alignment: Alignment.center,
        children: [
          avatar,
          const SizedBox(
            width: 64,
            height: 64,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ],
      );
    }

    if (onTap == null) return avatar;

    return ViroPressable(
      onTap: busy ? null : onTap,
      borderRadius: BorderRadius.circular(32),
      child: avatar,
    );
  }
}
