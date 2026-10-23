"use client";

import { MemberAvatar } from "@/components/dashboard/MemberAvatar";
import { convocationsCopy } from "@/lib/copy/convocationsCopy";
import styles from "./ConvocationChecklist.module.css";

/** Joueur affiché dans la liste à cocher. */
export type ConvocationChecklistItem = {
  key: string;
  name: string;
  avatarUrl: string | null;
};

/** Props de la liste à cocher des convoqués. */
type ConvocationChecklistProps = {
  /** Préfixe d’ids DOM (unique par dialog). */
  idPrefix: string;
  items: ConvocationChecklistItem[];
  checkedKeys: Set<string>;
  onChange: (nextCheckedKeys: Set<string>) => void;
  legend: string;
  hint?: string;
  emptyLabel: string;
  disabled?: boolean;
  /** Message d’erreur lié à la liste (`aria-invalid` + `aria-describedby`). */
  errorId?: string;
  invalid?: boolean;
};

/**
 * Liste de joueurs à cocher (cochés = convoqués), avec tout cocher /
 * décocher. Partagée par la création de match et « Gérer les convoqués ».
 */
export function ConvocationChecklist({
  idPrefix,
  items,
  checkedKeys,
  onChange,
  legend,
  hint,
  emptyLabel,
  disabled = false,
  errorId,
  invalid = false,
}: ConvocationChecklistProps) {
  const hintId = `${idPrefix}-hint`;
  const checkedCount = items.filter((item) => checkedKeys.has(item.key)).length;
  const describedBy =
    [hint ? hintId : null, invalid && errorId ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  function toggle(key: string, checked: boolean) {
    const next = new Set(checkedKeys);
    if (checked) next.add(key);
    else next.delete(key);
    onChange(next);
  }

  function setAll(checked: boolean) {
    onChange(checked ? new Set(items.map((item) => item.key)) : new Set());
  }

  return (
    <fieldset
      className={styles.fieldset}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      disabled={disabled}
    >
      <div className={styles.legendRow}>
        <legend className={styles.legend}>{legend}</legend>
        {items.length > 0 ? (
          <span className={styles.count} aria-live="polite">
            {convocationsCopy.countSummary(checkedCount, items.length)}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className={styles.empty}>{emptyLabel}</p>
      ) : (
        <>
          <div className={styles.bulkRow}>
            <button
              type="button"
              className={styles.bulkButton}
              onClick={() => setAll(true)}
              disabled={disabled || checkedCount === items.length}
            >
              {convocationsCopy.checkAll}
            </button>
            <button
              type="button"
              className={styles.bulkButton}
              onClick={() => setAll(false)}
              disabled={disabled || checkedCount === 0}
            >
              {convocationsCopy.uncheckAll}
            </button>
          </div>
          <ul className={styles.list}>
            {items.map((item) => {
              const checked = checkedKeys.has(item.key);
              const inputId = `${idPrefix}-${item.key}`;
              return (
                <li key={item.key}>
                  <label
                    className={styles.row}
                    htmlFor={inputId}
                    data-checked={checked ? "true" : "false"}
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={checked}
                      onChange={(changeEvent) =>
                        toggle(item.key, changeEvent.target.checked)
                      }
                    />
                    <MemberAvatar
                      displayName={item.name}
                      avatarUrl={item.avatarUrl}
                      hasLinkedAccount
                      enableZoom={false}
                      size="xs"
                      tone="offwhite"
                    />
                    <span className={styles.name}>{item.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </fieldset>
  );
}
