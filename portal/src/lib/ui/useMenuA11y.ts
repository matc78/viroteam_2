"use client";

import { useEffect, useRef, type RefObject } from "react";
import { nextMenuIndex } from "./menuNavigation";

const MENU_ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';

type UseMenuA11yOptions = {
  open: boolean;
  /** Fermeture (Escape, Tab, clic hors du menu). */
  onClose: () => void;
};

/**
 * Accessibilité d’un menu déroulant (bouton `aria-haspopup="menu"` + liste
 * `role="menu"` d’items `role="menuitem"`, tous deux dans `wrapRef`) :
 * focus sur le premier item à l’ouverture, flèches / Début / Fin, Escape
 * (referme et rend le focus au bouton), Tab et clic extérieur referment.
 *
 * Escape est capté sur `window` avant les dialogs (`useDialogA11y`) : il
 * ferme le menu sans fermer la fenêtre qui le contient.
 */
export function useMenuA11y({
  open,
  onClose,
}: UseMenuA11yOptions): {
  wrapRef: RefObject<HTMLDivElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
} {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    function items(): HTMLElement[] {
      return Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ??
          [],
      );
    }

    function focusTrigger() {
      wrapRef.current
        ?.querySelector<HTMLElement>('[aria-haspopup="menu"]')
        ?.focus({ preventScroll: true });
    }

    const focusTimer = window.requestAnimationFrame(() => {
      items()[0]?.focus({ preventScroll: true });
    });

    function onKeyDown(event: KeyboardEvent) {
      const wrap = wrapRef.current;
      const active = document.activeElement;
      if (!wrap || !wrap.contains(active)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        focusTrigger();
        return;
      }
      if (event.key === "Tab") {
        onCloseRef.current();
        return;
      }
      const list = items();
      const next = nextMenuIndex(
        event.key,
        list.indexOf(active as HTMLElement),
        list.length,
      );
      if (next == null) return;
      event.preventDefault();
      list[next]?.focus({ preventScroll: true });
    }

    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        onCloseRef.current();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return { wrapRef, menuRef };
}
