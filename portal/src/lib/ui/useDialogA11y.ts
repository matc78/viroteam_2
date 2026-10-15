"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Pile des dialogs ouverts (Escape / Tab = sommet uniquement). */
const dialogStack: Array<{ id: symbol }> = [];

type UseDialogA11yOptions = {
  /** Fermeture (Escape). */
  onClose: () => void;
  /** Désactiver le piège si le dialog n’est pas vraiment ouvert. */
  enabled?: boolean;
};

/**
 * Accessibilité dialog : focus initial, Tab cyclique, Escape, restore focus.
 *
 * Les dialogs empilés (ex. overlay chat dans FloatingThread) : seul le sommet
 * de pile reçoit Escape et le piège Tab.
 *
 * Attacher `containerRef` au nœud dialog (ou `wrapRef` d’un FadeScrollArea).
 */
export function useDialogA11y({
  onClose,
  enabled = true,
}: UseDialogA11yOptions): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const maybeRoot = containerRef.current;
    if (!maybeRoot) return;
    const dialogRoot: HTMLDivElement = maybeRoot;
    const stackEntry = { id: Symbol("dialog") };
    dialogStack.push(stackEntry);

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    function isTopDialog(): boolean {
      return dialogStack[dialogStack.length - 1] === stackEntry;
    }

    function listFocusables(): HTMLElement[] {
      return Array.from(
        dialogRoot.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => {
        if (element.getAttribute("aria-hidden") === "true") return false;
        if (element.tabIndex < 0) return false;
        const style = window.getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none") {
          return false;
        }
        return true;
      });
    }

    if (!dialogRoot.hasAttribute("tabindex")) {
      dialogRoot.tabIndex = -1;
    }

    const focusTimer = window.requestAnimationFrame(() => {
      if (!isTopDialog()) return;
      const first = listFocusables()[0] ?? dialogRoot;
      first.focus({ preventScroll: true });
    });

    function onKeyDown(event: KeyboardEvent) {
      if (!isTopDialog()) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = listFocusables();
      if (nodes.length === 0) {
        event.preventDefault();
        dialogRoot.focus({ preventScroll: true });
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !dialogRoot.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last || !dialogRoot.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("keydown", onKeyDown, true);
      const index = dialogStack.indexOf(stackEntry);
      if (index >= 0) dialogStack.splice(index, 1);
      if (
        previouslyFocused &&
        document.contains(previouslyFocused) &&
        typeof previouslyFocused.focus === "function"
      ) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [enabled]);

  return containerRef;
}
