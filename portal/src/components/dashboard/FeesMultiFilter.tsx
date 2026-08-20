"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useDismissOnOutsidePointer } from "@/lib/planning/useDismissOnOutsidePointer";
import styles from "./FeesMultiFilter.module.css";

/** Option d’un filtre multi cotisations. */
export type FeesMultiFilterOption = {
  value: string;
  label: string;
};

type FeesMultiFilterProps = {
  id: string;
  label: string;
  value: string[];
  options: FeesMultiFilterOption[];
  emptyLabel?: string;
  "aria-label"?: string;
  onChange: (next: string[]) => void;
};

/**
 * Filtre multi-sélection : trigger + liste à cases (style chips géré par le parent).
 */
export function FeesMultiFilter({
  id,
  label,
  value,
  options,
  emptyLabel = "Toutes",
  "aria-label": ariaLabel,
  onChange,
}: FeesMultiFilterProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [listStyle, setListStyle] = useState<CSSProperties | undefined>();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(value), [value]);
  const labelByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of options) map.set(option.value, option.label);
    return map;
  }, [options]);

  const selectedLabels = value
    .map((item) => labelByValue.get(item) ?? item)
    .filter(Boolean);

  const triggerText =
    selectedLabels.length === 0
      ? emptyLabel
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.length} sélectionnées`;

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(needle),
    );
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useDismissOnOutsidePointer(open, rootRef, close, listRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateListPosition = useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const maxHeight = 16 * 16;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUpward =
      spaceBelow < Math.min(maxHeight, 140) && spaceAbove > spaceBelow;
    const available = openUpward ? spaceAbove : spaceBelow;
    setListStyle({
      position: "fixed",
      left: rect.left,
      width: Math.max(rect.width, 14 * 16),
      maxHeight: Math.min(maxHeight, Math.max(available, 8 * 16)),
      top: openUpward ? undefined : rect.bottom + gap,
      bottom: openUpward
        ? window.innerHeight - rect.top + gap
        : undefined,
      zIndex: 90,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateListPosition();
    function handleViewport() {
      updateListPosition();
    }
    window.addEventListener("resize", handleViewport);
    window.addEventListener("scroll", handleViewport, true);
    return () => {
      window.removeEventListener("resize", handleViewport);
      window.removeEventListener("scroll", handleViewport, true);
    };
  }, [open, updateListPosition, filteredOptions.length]);

  function toggleValue(optionValue: string) {
    if (selectedSet.has(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
      return;
    }
    onChange([...value, optionValue]);
  }

  const listNode =
    open && mounted ? (
      <div
        ref={listRef}
        id={listboxId}
        className={styles.list}
        role="listbox"
        aria-multiselectable="true"
        style={listStyle}
      >
        {options.length > 6 ? (
          <input
            className={styles.search}
            type="search"
            value={query}
            placeholder="Rechercher…"
            aria-label={`Rechercher dans ${label}`}
            onChange={(event) => setQuery(event.target.value)}
          />
        ) : null}
        {filteredOptions.length === 0 ? (
          <p className={styles.empty}>Aucune option</p>
        ) : (
          <ul className={styles.options}>
            {filteredOptions.map((option) => {
              const checked = selectedSet.has(option.value);
              return (
                <li key={option.value}>
                  <label className={styles.option}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleValue(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-open={open ? "true" : "false"}
      data-active={value.length > 0 ? "true" : undefined}
    >
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        id={id}
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel ?? label}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span
          className={styles.value}
          data-placeholder={value.length === 0 ? "true" : "false"}
        >
          {triggerText}
        </span>
      </button>
      {listNode ? createPortal(listNode, document.body) : null}
    </div>
  );
}
