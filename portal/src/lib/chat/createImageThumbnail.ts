const THUMB_MAX_PX = 400;
const THUMB_JPEG_QUALITY = 0.82;

export type ImageDimensions = {
  width: number;
  height: number;
};

export type PreparedChatImage = {
  fullBytes: ArrayBuffer;
  thumbBytes: ArrayBuffer;
  width: number;
  height: number;
  contentType: string;
};

/**
 * Redimensionne une image en JPEG (~400 px max) pour la vignette chat.
 * Retourne aussi les dimensions de l’original.
 */
export async function createImageThumbnail(
  bytes: ArrayBuffer,
  maxSize = THUMB_MAX_PX,
): Promise<{ thumbBytes: ArrayBuffer } & ImageDimensions> {
  const blob = new Blob([bytes]);
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const thumbWidth = Math.max(1, Math.round(width * scale));
  const thumbHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = thumbWidth;
  canvas.height = thumbHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Canvas indisponible.");
  }
  context.drawImage(bitmap, 0, 0, thumbWidth, thumbHeight);
  bitmap.close();

  const thumbBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Génération vignette impossible."));
      },
      "image/jpeg",
      THUMB_JPEG_QUALITY,
    );
  });

  return {
    thumbBytes: await thumbBlob.arrayBuffer(),
    width,
    height,
  };
}

/**
 * Prépare bytes full + thumb JPEG pour l’envoi chat.
 * Convertit le full en JPEG via canvas si besoin (paste PNG, etc.).
 */
export async function prepareChatImageUpload(
  bytes: ArrayBuffer,
  contentType?: string,
): Promise<PreparedChatImage> {
  const normalizedType = contentType?.startsWith("image/")
    ? contentType
    : "image/jpeg";

  if (normalizedType === "image/jpeg") {
    const { thumbBytes, width, height } = await createImageThumbnail(bytes);
    return {
      fullBytes: bytes,
      thumbBytes,
      width,
      height,
      contentType: "image/jpeg",
    };
  }

  const blob = new Blob([bytes], { type: normalizedType });
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;

  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = width;
  fullCanvas.height = height;
  const fullContext = fullCanvas.getContext("2d");
  if (!fullContext) {
    bitmap.close();
    throw new Error("Canvas indisponible.");
  }
  fullContext.drawImage(bitmap, 0, 0);
  bitmap.close();

  const fullBlob = await new Promise<Blob>((resolve, reject) => {
    fullCanvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Conversion image impossible."));
      },
      "image/jpeg",
      0.92,
    );
  });
  const fullBytes = await fullBlob.arrayBuffer();
  const { thumbBytes } = await createImageThumbnail(fullBytes);

  return {
    fullBytes,
    thumbBytes,
    width,
    height,
    contentType: "image/jpeg",
  };
}
