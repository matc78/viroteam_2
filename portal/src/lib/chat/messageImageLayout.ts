/**
 * Gabarit d’une photo dans une bulle — mêmes valeurs que `ViroChat`
 * (`imageWidth`, `imageMinHeight`, `imageMaxHeight`) et que les tokens
 * `--chat-image-*` de `globals.css`.
 */
export const CHAT_IMAGE_WIDTH = 220;
export const CHAT_IMAGE_MIN_HEIGHT = 120;
export const CHAT_IMAGE_MAX_HEIGHT = 320;

/**
 * Hauteur d’affichage (px, pour une largeur de `CHAT_IMAGE_WIDTH`) d’une photo
 * de `width` × `height` : hauteur au ratio, bornée ; carré tant que les
 * dimensions sont inconnues ou invalides (identique à `chatThreadImageSize`
 * côté app).
 */
export function messageImageDisplayHeight(
  width: number | null | undefined,
  height: number | null | undefined,
): number {
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return CHAT_IMAGE_WIDTH;
  }
  const scaled = (CHAT_IMAGE_WIDTH * height) / width;
  return Math.min(Math.max(scaled, CHAT_IMAGE_MIN_HEIGHT), CHAT_IMAGE_MAX_HEIGHT);
}

/**
 * Ratio CSS (`aspect-ratio`) de l’emplacement réservé à la photo : la place est
 * fixée avant le chargement (pas de saut de mise en page) et l’emplacement
 * peut rétrécir avec la bulle sans se déformer.
 */
export function messageImageAspectRatio(
  width: number | null | undefined,
  height: number | null | undefined,
): string {
  const displayHeight = messageImageDisplayHeight(width, height);
  return `${CHAT_IMAGE_WIDTH} / ${Math.round(displayHeight)}`;
}
