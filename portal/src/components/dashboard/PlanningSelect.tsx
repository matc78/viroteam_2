"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useDismissOnOutsidePointer } from "@/lib/planning/useDismissOnOutsidePointer";
import styles from "./PlanningSelect.module.css";

/** Option d'un sélecteur planning custom. */
export type PlanningSelectOption = {
  value: string;
  label: string;
};

type PlanningSelectProps = {
  id: string;
  value: string;
  options: PlanningSelectOption[];
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  /**
   * Si défini, limite la hauteur visible et centre la sélection
   * (ex. 2 → 2 au-dessus + sélection + 2 en dessous).
   */
  visibleNeighbors?: number;
  /**
   * Placement de la liste : `up` force l’ouverture vers le haut
   * (utile pour une barre sticky en bas d’écran).
   */
  placement?: "auto" | "up" | "down";
  onChange: (value: string) => void;
};

/**
 * Sélecteur custom mono-valeur (aligné sur le time picker planning).
 * La liste est portée en `fixed` via portal pour éviter le clipping overflow.
 */
export function PlanningSelect({
  id,
  value,
  options,
  disabled = false,
  required = false,
  placeholder = "Choisir…",
  "aria-label": ariaLabel,
  visibleNeighbors,
  placement = "auto",
  onChange,
}: PlanningSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const [open, setOpen] = useState(false);
  const [optionHeight, setOptionHeight] = useState(0);
  const [highlighted, setHighlighted] = useState(value);
  const [listStyle, setListStyle] = useState<CSSProperties | undefined>();
  const [mounted, setMounted] = useState(false);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? placeholder;
  const visibleCount =
    visibleNeighbors !== undefined ? visibleNeighbors * 2 + 1 : undefined;

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const openList = useCallback(() => {
    if (disabled) return;
    setHighlighted(value || options[0]?.value || "");
    setOpen(true);
  }, [disabled, value, options]);

  const selectOption = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setOpen(false);
    },
    [onChange],
  );

  const updateListPosition = useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const listVerticalPadding = 6.4;
    const contentHeight =
      optionHeight > 0
        ? optionHeight * options.length + listVerticalPadding + 1
        : 11 * 16;
    const maxListHeight =
      visibleCount !== undefined && optionHeight > 0
        ? optionHeight * visibleCount
        : contentHeight;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUpward =
      placement === "up"
        ? true
        : placement === "down"
          ? false
          : spaceBelow < Math.min(maxListHeight, 120) &&
            spaceAbove > spaceBelow;
    const available = openUpward ? spaceAbove : spaceBelow;
    const height = Math.min(maxListHeight, Math.max(80, available));
    const fitsWithoutScroll = height >= maxListHeight;

    setListStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      maxHeight: height,
      overflowY: fitsWithoutScroll ? "hidden" : "auto",
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + gap, top: "auto" }
        : { top: rect.bottom + gap, bottom: "auto" }),
    });
  }, [optionHeight, options.length, placement, visibleCount]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useDismissOnOutsidePointer(open, rootRef, close, listRef);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open) return;
    updateListPosition();
    function handleReposition() {
      updateListPosition();
    }
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, updateListPosition]);

  useLayoutEffect(() => {
    if (!open) return;
    const selectedNode =
      optionRefs.current.get(value) ??
      optionRefs.current.get(options[0]?.value ?? "");
    if (selectedNode) {
      setOptionHeight(selectedNode.offsetHeight);
    }
    listRef.current?.focus({ preventScroll: true });
  }, [open, value, options]);

  useLayoutEffect(() => {
    if (
      !open ||
      !listRef.current ||
      optionHeight <= 0 ||
      visibleNeighbors === undefined
    ) {
      return;
    }
    const list = listRef.current;
    list.scrollTop = Math.max(
      0,
      selectedIndex * optionHeight - visibleNeighbors * optionHeight,
    );
  }, [open, optionHeight, selectedIndex, visibleNeighbors]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openList();
    }
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const currentIndex = Math.max(
      0,
      options.findIndex((option) => option.value === highlighted),
    );
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = Math.min(options.length - 1, currentIndex + 1);
      const nextValue = options[nextIndex]?.value;
      if (nextValue) {
        setHighlighted(nextValue);
        optionRefs.current.get(nextValue)?.scrollIntoView({ block: "nearest" });
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = Math.max(0, currentIndex - 1);
      const prevValue = options[prevIndex]?.value;
      if (prevValue) {
        setHighlighted(prevValue);
        optionRefs.current.get(prevValue)?.scrollIntoView({ block: "nearest" });
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (highlighted) selectOption(highlighted);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  const listNode =
    open && mounted ? (
      <ul
        ref={listRef}
        id={listboxId}
        className={styles.list}
        role="listbox"
        tabIndex={-1}
        aria-activedescendant={
          highlighted ? `${listboxId}-${highlighted}` : undefined
        }
        style={listStyle}
        data-compact={visibleNeighbors !== undefined ? "true" : "false"}
        data-portal="true"
        onKeyDown={handleListKeyDown}
      >
        {options.length === 0 ? (
          <li className={styles.empty}>Aucune option</li>
        ) : (
          options.map((option) => {
            const isSelected = option.value === value;
            const isHighlighted = option.value === highlighted;
            return (
              <li
                key={option.value}
                id={`${listboxId}-${option.value}`}
                ref={(node) => {
                  if (node) optionRefs.current.set(option.value, node);
                  else optionRefs.current.delete(option.value);
                }}
                role="option"
                className={styles.option}
                aria-selected={isSelected}
                data-selected={isSelected ? "true" : "false"}
                data-highlighted={isHighlighted ? "true" : "false"}
                onMouseEnter={() => setHighlighted(option.value)}
                onClick={() => selectOption(option.value)}
              >
                {option.label}
              </li>
            );
          })
        )}
      </ul>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-open={open ? "true" : "false"}
    >
      <button
        type="button"
        id={id}
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          className={styles.value}
          data-placeholder={value ? "false" : "true"}
        >
          {selectedLabel}
        </span>
      </button>

      {listNode ? createPortal(listNode, document.body) : null}
    </div>
  );
}
