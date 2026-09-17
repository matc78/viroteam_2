import 'dart:typed_data';
import 'dart:ui' as ui;

/// Décodage image + miniature JPEG/PNG pour l’upload chat.
class ChatImagePrepareResult {
  const ChatImagePrepareResult({
    required this.fullBytes,
    required this.thumbBytes,
    required this.width,
    required this.height,
    required this.thumbContentType,
  });

  final Uint8List fullBytes;
  final Uint8List thumbBytes;
  final int width;
  final int height;
  final String thumbContentType;
}

/// Prépare full + thumb (max [maxThumbSide] px, PNG) pour un envoi photo.
Future<ChatImagePrepareResult> prepareChatImageUpload(
  Uint8List bytes, {
  int maxThumbSide = 400,
}) async {
  final fullCodec = await ui.instantiateImageCodec(bytes);
  final fullFrame = await fullCodec.getNextFrame();
  final fullImage = fullFrame.image;
  final width = fullImage.width;
  final height = fullImage.height;

  final targetWidth = width > height
      ? (width > maxThumbSide ? maxThumbSide : null)
      : null;
  final targetHeight = height >= width
      ? (height > maxThumbSide ? maxThumbSide : null)
      : null;

  late final Uint8List thumbBytes;
  if (targetWidth == null && targetHeight == null) {
    // Déjà petit : encode quand même en PNG (chemin `_thumb.png` + MIME cohérent).
    final byteData =
        await fullImage.toByteData(format: ui.ImageByteFormat.png);
    thumbBytes = byteData?.buffer.asUint8List() ?? bytes;
    fullImage.dispose();
    fullCodec.dispose();
    return ChatImagePrepareResult(
      fullBytes: bytes,
      thumbBytes: thumbBytes,
      width: width,
      height: height,
      thumbContentType: 'image/png',
    );
  }

  final thumbCodec = await ui.instantiateImageCodec(
    bytes,
    targetWidth: targetWidth,
    targetHeight: targetHeight,
  );
  final thumbFrame = await thumbCodec.getNextFrame();
  final thumbImage = thumbFrame.image;
  final byteData =
      await thumbImage.toByteData(format: ui.ImageByteFormat.png);
  thumbBytes = byteData?.buffer.asUint8List() ?? bytes;
  thumbImage.dispose();
  thumbCodec.dispose();
  fullImage.dispose();
  fullCodec.dispose();

  return ChatImagePrepareResult(
    fullBytes: bytes,
    thumbBytes: thumbBytes,
    width: width,
    height: height,
    thumbContentType: 'image/png',
  );
}
