"use client";

import { useEffect, type RefObject } from "react";

/**
 * Ferme un overlay quand un `mousedown` a lieu hors de `rootRef`.
 * Ne s'enregistre que lorsque `open` est vrai.
 */
export function useDismissOnOutsidePointer(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onDismiss();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, rootRef, onDismiss]);
}
