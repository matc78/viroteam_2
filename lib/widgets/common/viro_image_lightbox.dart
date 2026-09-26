import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:viro_team_v2/config/viro_colors.dart';
import 'package:viro_team_v2/config/viro_icons.dart';
import 'package:viro_team_v2/config/viro_spacing.dart';
import 'package:viro_team_v2/copy/app_copy.dart';

/// Forme d’affichage de l’image dans le lightbox.
enum ViroImageLightboxShape {
  /// Avatar circulaire.
  circle,

  /// Logo / media à coins arrondis.
  rounded,

  /// Image libre (messages chat).
  free,
}

/// Overlay plein écran pour agrandir une photo (pinch/zoom).
///
/// Fournir [imageUrl] et/ou [imageBytes]. Si [onEdit] est fourni, affiche
/// un bouton « Modifier » qui ferme le dialog puis appelle le callback.
Future<void> showViroImageLightbox(
  BuildContext context, {
  String? imageUrl,
  Uint8List? imageBytes,
  String? semanticLabel,
  VoidCallback? onEdit,
  ViroImageLightboxShape shape = ViroImageLightboxShape.free,
}) {
  assert(
    (imageUrl != null && imageUrl.trim().isNotEmpty) ||
        (imageBytes != null && imageBytes.isNotEmpty),
    'showViroImageLightbox requires imageUrl or imageBytes',
  );
  return showDialog<void>(
    context: context,
    barrierColor: ViroColors.primary900.withValues(alpha: 0.92),
    builder: (dialogContext) {
      return _ViroImageLightboxDialog(
        imageUrl: imageUrl?.trim(),
        imageBytes: imageBytes,
        semanticLabel: semanticLabel,
        onEdit: onEdit,
        shape: shape,
      );
    },
  );
}

class _ViroImageLightboxDialog extends StatelessWidget {
  const _ViroImageLightboxDialog({
    required this.shape,
    this.imageUrl,
    this.imageBytes,
    this.semanticLabel,
    this.onEdit,
  });

  final String? imageUrl;
  final Uint8List? imageBytes;
  final String? semanticLabel;
  final VoidCallback? onEdit;
  final ViroImageLightboxShape shape;

  ImageProvider get _provider {
    if (imageBytes != null && imageBytes!.isNotEmpty) {
      return MemoryImage(imageBytes!);
    }
    return NetworkImage(imageUrl!);
  }

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    final topPad = MediaQuery.paddingOf(context).top;

    return Semantics(
      label: semanticLabel,
      child: GestureDetector(
        onTap: () => Navigator.of(context).pop(),
        behavior: HitTestBehavior.opaque,
        child: Stack(
          children: [
            Center(
              child: InteractiveViewer(
                minScale: 1,
                maxScale: 4,
                child: GestureDetector(
                  onTap: () {},
                  child: _shapedImage(context),
                ),
              ),
            ),
            Positioned(
              top: topPad + ViroSpacing.sm,
              right: ViroSpacing.md,
              child: IconButton(
                onPressed: () => Navigator.of(context).pop(),
                tooltip: AppCopy.common.close,
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
            if (onEdit != null)
              Positioned(
                left: ViroSpacing.lg,
                right: ViroSpacing.lg,
                bottom: bottomPad + ViroSpacing.lg,
                child: SafeArea(
                  top: false,
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 320),
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.of(context).pop();
                          onEdit!();
                        },
                        icon: ViroIcon(ViroIcons.edit, size: 18),
                        label: Text(AppCopy.common.edit),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _errorPlaceholder(double maxSide) {
    return Container(
      width: maxSide,
      height: maxSide,
      color: ViroColors.gray200,
      alignment: Alignment.center,
      child: ViroIcon(
        ViroIcons.image,
        size: 64,
        color: ViroColors.gray600,
      ),
    );
  }

  Widget _shapedImage(BuildContext context) {
    final screen = MediaQuery.sizeOf(context);
    final maxSide = (screen.shortestSide * 0.85).clamp(200.0, 420.0);
    final provider = _provider;

    switch (shape) {
      case ViroImageLightboxShape.circle:
        return ClipOval(
          child: Image(
            image: provider,
            width: maxSide,
            height: maxSide,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) =>
                _errorPlaceholder(maxSide),
          ),
        );
      case ViroImageLightboxShape.rounded:
        return ClipRRect(
          borderRadius: BorderRadius.circular(ViroSpacing.cardRadius),
          child: Image(
            image: provider,
            width: maxSide,
            height: maxSide,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) =>
                _errorPlaceholder(maxSide),
          ),
        );
      case ViroImageLightboxShape.free:
        return ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: screen.width * 0.96,
            maxHeight: screen.height * 0.85,
          ),
          child: Image(
            image: provider,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) =>
                _errorPlaceholder(maxSide),
          ),
        );
    }
  }
}
