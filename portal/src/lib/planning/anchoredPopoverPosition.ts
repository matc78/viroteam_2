/** Rectangle d'ancrage viewport pour un popover planning. */
export type PopoverAnchorRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export const ANCHORED_POPOVER_GAP_PX = 14;
export const ANCHORED_POPOVER_MARGIN_PX = 16;
export const ANCHORED_POPOVER_FALLBACK_WIDTH_PX = 416;

/**
 * Place un panneau au milieu vertical de l'écran, à gauche ou à droite
 * de l'ancre selon l'espace disponible.
 */
export function computeAnchoredPosition(
  anchor: PopoverAnchorRect,
  panelWidth: number,
  panelHeight: number,
): { left: number; top: number; side: "left" | "right" } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spaceRight = viewportWidth - anchor.right - ANCHORED_POPOVER_MARGIN_PX;
  const spaceLeft = anchor.left - ANCHORED_POPOVER_MARGIN_PX;
  const preferRight =
    spaceRight >= panelWidth + ANCHORED_POPOVER_GAP_PX || spaceRight >= spaceLeft;

  let left = preferRight
    ? anchor.right + ANCHORED_POPOVER_GAP_PX
    : anchor.left - ANCHORED_POPOVER_GAP_PX - panelWidth;
  left = Math.max(
    ANCHORED_POPOVER_MARGIN_PX,
    Math.min(left, viewportWidth - panelWidth - ANCHORED_POPOVER_MARGIN_PX),
  );

  let top = (viewportHeight - panelHeight) / 2;
  top = Math.max(
    ANCHORED_POPOVER_MARGIN_PX,
    Math.min(top, viewportHeight - panelHeight - ANCHORED_POPOVER_MARGIN_PX),
  );

  return { left, top, side: preferRight ? "right" : "left" };
}

/** Construit un rect d'ancrage depuis un élément du DOM. */
export function rectFromElement(element: Element): PopoverAnchorRect {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}

/** Cherche le bloc calendrier d'un événement pour ancrer le popover. */
export function findEventBlockAnchor(
  eventId: string,
): PopoverAnchorRect | null {
  if (typeof document === "undefined") return null;
  const element = document.querySelector(
    `[data-event-id="${CSS.escape(eventId)}"]`,
  );
  if (!element) return null;
  return rectFromElement(element);
}
