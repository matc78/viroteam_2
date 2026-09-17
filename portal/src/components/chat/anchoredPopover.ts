/** Position calculée pour un popover collé à une ancre (bulle / chips). */
export type AnchoredPopoverLayout = {
  left: number;
  /**
   * Coordonnée Y fixe :
   * - `below` : bord haut du popup (= sous l’ancre)
   * - `above` : bord bas du popup (= au-dessus de l’ancre) → appliquer `translateY(-100%)`
   */
  top: number;
  maxHeight: number;
  placement: "below" | "above";
  width: number;
};

type ComputeAnchoredPopoverParams = {
  anchorRect: DOMRect;
  /** Zone visible (fil de messages) — borne le popup sous le header / au-dessus du composer. */
  viewportRect: DOMRect;
  popupWidth: number;
  /** Hauteur estimée du contenu (pour choisir above/below). */
  estimatedHeight?: number;
  maxHeight?: number;
  gap?: number;
  edge?: number;
  preferBelowMin?: number;
  /** Aligner le bord droit du popup sur le bord droit de l’ancre. */
  alignEnd?: boolean;
};

/**
 * Calcule left/top/maxHeight en fixed coords : sous l’ancre, ou au-dessus si pas de place.
 * Placement `above` : `top` = bord bas du popup → le consommateur applique `translateY(-100%)`
 * pour coller le popup juste au-dessus sans chevaucher l’ancre (quelle que soit la hauteur réelle).
 */
export function computeAnchoredPopover(
  params: ComputeAnchoredPopoverParams,
): AnchoredPopoverLayout | null {
  const {
    anchorRect,
    viewportRect,
    popupWidth,
    estimatedHeight = 200,
    maxHeight = 320,
    gap = 10,
    edge = 8,
    preferBelowMin = 120,
    alignEnd = false,
  } = params;

  if (anchorRect.width <= 0 || anchorRect.height <= 0) return null;

  const spaceBelow = viewportRect.bottom - anchorRect.bottom - gap - edge;
  const spaceAbove = anchorRect.top - viewportRect.top - gap - edge;
  const showBelow = spaceBelow >= preferBelowMin || spaceBelow >= spaceAbove;

  let top: number;
  let available: number;
  let placement: "below" | "above";

  if (showBelow) {
    placement = "below";
    top = Math.max(anchorRect.bottom + gap, viewportRect.top + edge);
    available = viewportRect.bottom - top - edge;
  } else {
    placement = "above";
    // Pin le bord bas du popup juste au-dessus de l’ancre.
    top = Math.min(anchorRect.top - gap, viewportRect.bottom - edge);
    available = top - (viewportRect.top + edge);
    // Si trop près du haut du viewport, on bascule sous l’ancre.
    if (available < 72 && spaceBelow >= 72) {
      placement = "below";
      top = Math.max(anchorRect.bottom + gap, viewportRect.top + edge);
      available = viewportRect.bottom - top - edge;
    } else if (available < Math.min(estimatedHeight, maxHeight) && spaceBelow > spaceAbove) {
      placement = "below";
      top = Math.max(anchorRect.bottom + gap, viewportRect.top + edge);
      available = viewportRect.bottom - top - edge;
    }
  }

  const clampedMaxHeight = Math.min(Math.max(available, 72), maxHeight);
  if (clampedMaxHeight < 72) return null;

  let left = alignEnd
    ? anchorRect.right - popupWidth
    : anchorRect.left;
  const minLeft = viewportRect.left + edge;
  const maxLeft = viewportRect.right - popupWidth - edge;
  if (maxLeft < minLeft) {
    left = minLeft;
  } else {
    left = Math.min(Math.max(left, minLeft), maxLeft);
  }

  return {
    left,
    top,
    maxHeight: clampedMaxHeight,
    placement,
    width: Math.min(popupWidth, viewportRect.width - edge * 2),
  };
}

/**
 * Remonte jusqu’au premier ancêtre scrollable (overflow auto/scroll).
 */
export function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}
