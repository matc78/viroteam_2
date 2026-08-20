"use client";

import { useEffect, type RefObject } from "react";

/**
 * Ferme un overlay quand un `mousedown` a lieu hors de `rootRef`
 * (et hors de `extraRef` si fourni, ex. liste portée en portal).
 * Ne s'enregistre que lorsque `open` est vrai.
 */
export function useDismissOnOutsidePointer(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  extraRef?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (extraRef?.current?.contains(target)) return;
      onDismiss();
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, rootRef, extraRef, onDismiss]);
}
