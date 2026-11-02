import styles from "./DateBadge.module.css";

/** Bloc date compact (jour en gros, mois abrégé) en tête de ligne d’événement. */
export function DateBadge({
  iso,
  size = "md",
}: {
  iso: string;
  size?: "md" | "lg";
}) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short" })
    .format(date)
    .replace(".", "");
  const month = new Intl.DateTimeFormat("fr-FR", { month: "short" })
    .format(date)
    .replace(".", "");
  return (
    <span className={styles.badge} data-size={size} aria-hidden>
      <span className={styles.weekday}>{weekday}</span>
      <span className={styles.day}>{date.getDate()}</span>
      <span className={styles.month}>{month}</span>
    </span>
  );
}
