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

type DialogStackEntry = {
  root: HTMLElement;
  modal: boolean;
};

/** Pile des dialogs ouverts (Escape / Tab = sommet uniquement). */
const dialogStack: DialogStackEntry[] = [];

/**
 * Dialog qui reçoit Escape : le plus haut qui est modal ou contient le focus
 * (un dialog non modal ne réagit que si le focus est chez lui).
 */
export function dialogOwningEscape<T extends { modal: boolean }>(
  stack: readonly T[],
  containsFocus: (entry: T) => boolean,
): T | undefined {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const entry = stack[index];
    if (entry.modal || containsFocus(entry)) return entry;
  }
  return undefined;
}

type UseDialogA11yOptions = {
  /** Fermeture (Escape). */
  onClose: () => void;
  /** Désactiver le piège si le dialog n’est pas vraiment ouvert. */
  enabled?: boolean;
  /**
   * `false` = dialog non modal (panneau latéral, fenêtre flottante) : focus
   * initial et restauré, Escape quand le focus est dedans, mais pas de piège
   * Tab (le reste de la page reste joignable au clavier).
   */
  modal?: boolean;
};

/**
 * Accessibilité dialog : focus initial, Tab cyclique, Escape, restore focus.
 *
 * Les dialogs empilés (ex. overlay chat dans FloatingThread) : seul le sommet
 * de pile reçoit Escape et le piège Tab ; un dialog non modal (`modal: false`)
 * n’a pas de piège Tab et ne reçoit Escape que s’il contient le focus.
 *
 * Attacher `containerRef` au nœud dialog (ou `wrapRef` d’un FadeScrollArea).
 */
export function useDialogA11y({
  onClose,
  enabled = true,
  modal = true,
}: UseDialogA11yOptions): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const maybeRoot = containerRef.current;
    if (!maybeRoot) return;
    const dialogRoot: HTMLDivElement = maybeRoot;
    const stackEntry: DialogStackEntry = { root: dialogRoot, modal };
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
      if (event.key === "Escape") {
        const owner = dialogOwningEscape(dialogStack, (entry) =>
          entry.root.contains(document.activeElement),
        );
        if (owner !== stackEntry) return;
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !modal || !isTopDialog()) return;

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
  }, [enabled, modal]);

  return containerRef;
}
