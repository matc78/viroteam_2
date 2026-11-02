import styles from "./SegmentedChoice.module.css";

/** Option d’un choix segmenté. */
export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Couleur une fois sélectionnée (RSVP : oui = success, non = danger). */
  tone?: "accent" | "success" | "warning" | "danger";
};

/** Props du choix segmenté. */
type SegmentedChoiceProps<T extends string> = {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T | "" | null;
  onSelect: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  busy?: boolean;
  size?: "sm" | "md";
};

/**
 * Groupe de boutons exclusifs (RSVP, filtres). Chaque bouton expose
 * `aria-pressed` ; l’option choisie prend sa tonalité.
 */
export function SegmentedChoice<T extends string>({
  options,
  value,
  onSelect,
  ariaLabel,
  disabled = false,
  busy = false,
  size = "md",
}: SegmentedChoiceProps<T>) {
  return (
    <div
      className={styles.group}
      role="group"
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      data-size={size}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={styles.option}
            data-tone={option.tone ?? "accent"}
            data-value={option.value}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
