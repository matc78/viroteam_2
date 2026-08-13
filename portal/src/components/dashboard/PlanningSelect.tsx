"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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
  onChange: (value: string) => void;
};

/**
 * Sélecteur custom mono-valeur (aligné sur le time picker planning).
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
  onChange,
}: PlanningSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const [open, setOpen] = useState(false);
  const [optionHeight, setOptionHeight] = useState(0);
  const [highlighted, setHighlighted] = useState(value);

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

  useDismissOnOutsidePointer(open, rootRef, close);

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

  const listMaxHeight =
    visibleCount !== undefined && optionHeight > 0
      ? optionHeight * visibleCount
      : undefined;

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

      {open ? (
        <ul
          ref={listRef}
          id={listboxId}
          className={styles.list}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={
            highlighted ? `${listboxId}-${highlighted}` : undefined
          }
          style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}
          data-compact={visibleNeighbors !== undefined ? "true" : "false"}
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
      ) : null}
    </div>
  );
}
