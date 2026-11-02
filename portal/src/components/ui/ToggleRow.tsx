import type { ReactNode } from "react";
import styles from "./ToggleRow.module.css";

/** Props d’une ligne de réglage avec interrupteur. */
type ToggleRowProps = {
  label: string;
  description?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  /** Sous-option : indentée sous son réglage parent. */
  nested?: boolean;
  onChange: (checked: boolean) => void;
};

/**
 * Réglage on/off : libellé et description à gauche, interrupteur à droite.
 * À empiler dans `SettingRows` (séparateurs).
 */
export function ToggleRow({
  label,
  description,
  checked,
  disabled = false,
  nested = false,
  onChange,
}: ToggleRowProps) {
  return (
    <li className={styles.row} data-nested={nested}>
      <div className={styles.text}>
        <span className={styles.label}>{label}</span>
        {description ? (
          <span className={styles.description}>{description}</span>
        ) : null}
      </div>
      <label className={styles.switch} data-disabled={disabled}>
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className={styles.track} aria-hidden="true" />
      </label>
    </li>
  );
}

/** Props d’une ligne de réglage générique (select, bouton, valeur). */
type SettingRowProps = {
  label: string;
  description?: ReactNode;
  /** Contrôle à droite. */
  control: ReactNode;
  nested?: boolean;
};

/** Ligne de réglage avec un contrôle libre à droite. */
export function SettingRow({
  label,
  description,
  control,
  nested = false,
}: SettingRowProps) {
  return (
    <li className={styles.row} data-nested={nested}>
      <div className={styles.text}>
        <span className={styles.label}>{label}</span>
        {description ? (
          <span className={styles.description}>{description}</span>
        ) : null}
      </div>
      <div className={styles.control}>{control}</div>
    </li>
  );
}

/** Liste de `ToggleRow` / `SettingRow` avec séparateurs. */
export function SettingRows({ children }: { children: ReactNode }) {
  return <ul className={styles.list}>{children}</ul>;
}
