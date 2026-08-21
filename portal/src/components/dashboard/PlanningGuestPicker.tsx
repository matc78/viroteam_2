"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  PlanningPersonOption,
  TeamOption,
} from "@/lib/firebase/eventService";
import {
  type PlanningGuestKind,
  type PlanningGuestSelection,
} from "@/lib/planning/resolveGuestAudience";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import { useDismissOnOutsidePointer } from "@/lib/planning/useDismissOnOutsidePointer";
import styles from "./PlanningGuestPicker.module.css";

export type { PlanningGuestKind, PlanningGuestSelection };

type GuestSuggestion = PlanningGuestSelection & {
  label: string;
  meta: string;
  searchText: string;
};

type PlanningGuestPickerProps = {
  id: string;
  teams: TeamOption[];
  categories: string[];
  people?: PlanningPersonOption[];
  /** Kinds proposés dans les suggestions. */
  allowedKinds: PlanningGuestKind[];
  value: PlanningGuestSelection[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: PlanningGuestSelection[]) => void;
};

const ROLE_LABELS: Record<PlanningPersonOption["role"], string> = {
  player: "Joueur",
  coach: "Coach",
  admin: "Admin",
  other: "Membre",
};

function selectionKey(item: PlanningGuestSelection): string {
  return `${item.kind}:${item.id}`;
}

function normalizeQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Sélecteur multi style Google Calendar « Add guests » :
 * chips + champ de recherche avec suggestions groupées.
 */
export function PlanningGuestPicker({
  id,
  teams,
  categories,
  people = [],
  allowedKinds,
  value,
  disabled = false,
  placeholder = "Ajouter…",
  onChange,
}: PlanningGuestPickerProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const close = useCallback(() => setOpen(false), []);
  useDismissOnOutsidePointer(open, rootRef, close);

  const selectedKeys = useMemo(
    () => new Set(value.map(selectionKey)),
    [value],
  );

  /** Catalogue unique (labels + meta) pour chips et suggestions. */
  const catalog = useMemo(() => {
    const items: GuestSuggestion[] = [];

    for (const team of teams) {
      const meta = team.category ? `Équipe · ${team.category}` : "Équipe";
      items.push({
        kind: "team",
        id: team.id,
        label: team.name,
        meta,
        searchText: `${team.name} ${team.category}`,
      });
    }

    for (const category of categories) {
      items.push({
        kind: "category",
        id: category,
        label: category,
        meta: "Catégorie",
        searchText: category,
      });
    }

    for (const person of people) {
      const meta = ROLE_LABELS[person.role];
      items.push({
        kind: "person",
        id: person.id,
        label: person.name,
        meta,
        searchText: `${person.name} ${meta}`,
      });
    }

    return items;
  }, [teams, categories, people]);

  const labelByKey = useMemo(() => {
    const map = new Map<string, { label: string; meta: string }>();
    for (const item of catalog) {
      map.set(selectionKey(item), { label: item.label, meta: item.meta });
    }
    return map;
  }, [catalog]);

  const suggestions = useMemo(() => {
    const normalized = normalizeQuery(query);
    const allowed = new Set(allowedKinds);
    return catalog
      .filter((item) => {
        if (!allowed.has(item.kind)) return false;
        if (selectedKeys.has(selectionKey(item))) return false;
        if (!normalized) return true;
        return normalizeQuery(item.searchText).includes(normalized);
      })
      .slice(0, 40);
  }, [allowedKinds, catalog, query, selectedKeys]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, open, suggestions.length]);

  function addGuest(guest: PlanningGuestSelection) {
    if (selectedKeys.has(selectionKey(guest))) return;
    onChange([...value, guest]);
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function removeGuest(guest: PlanningGuestSelection) {
    onChange(value.filter((item) => selectionKey(item) !== selectionKey(guest)));
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && query.length === 0 && value.length > 0) {
      event.preventDefault();
      const last = value[value.length - 1];
      if (last) removeGuest(last);
      return;
    }
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((current) =>
        suggestions.length === 0
          ? 0
          : Math.min(suggestions.length - 1, current + 1),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const suggestion = suggestions[highlightIndex];
      if (suggestion) {
        addGuest({ kind: suggestion.kind, id: suggestion.id });
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-open={open ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
    >
      <div
        className={styles.field}
        onClick={() => {
          if (disabled) return;
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        {value.map((guest) => {
          const details = labelByKey.get(selectionKey(guest));
          return (
            <span
              key={selectionKey(guest)}
              className={styles.chip}
              data-kind={guest.kind}
            >
              <span className={styles.chipLabel}>
                {details?.label ?? guest.id}
              </span>
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`Retirer ${details?.label ?? guest.id}`}
                disabled={disabled}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  removeGuest(guest);
                }}
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          id={id}
          className={styles.input}
          value={query}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : ""}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          autoComplete="off"
          onChange={(changeEvent) => {
            setQuery(changeEvent.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleInputKeyDown}
        />
      </div>

      {open && !disabled ? (
        <FadeScrollArea
          as="ul"
          className={styles.list}
          viewportClassName={styles.listViewport}
          id={listboxId}
          role="listbox"
        >
          {suggestions.length === 0 ? (
            <li className={styles.empty}>Aucun résultat</li>
          ) : (
            suggestions.map((suggestion, index) => (
              <li key={selectionKey(suggestion)} role="presentation">
                <button
                  type="button"
                  role="option"
                  className={styles.option}
                  aria-selected={index === highlightIndex}
                  data-highlighted={index === highlightIndex ? "true" : "false"}
                  data-kind={suggestion.kind}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() =>
                    addGuest({ kind: suggestion.kind, id: suggestion.id })
                  }
                >
                  <span className={styles.optionLabel}>{suggestion.label}</span>
                  <span className={styles.optionMeta}>{suggestion.meta}</span>
                </button>
              </li>
            ))
          )}
        </FadeScrollArea>
      ) : null}
    </div>
  );
}
