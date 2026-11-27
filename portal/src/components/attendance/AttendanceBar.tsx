import styles from "./AttendanceBar.module.css";

/** Ton d’un taux de présence : ≥ 75 bon, ≥ 50 moyen, sinon faible. */
export function attendanceTone(
  rate: number | null,
): "success" | "warning" | "danger" | "neutral" {
  if (rate === null) return "neutral";
  if (rate >= 75) return "success";
  if (rate >= 50) return "warning";
  return "danger";
}

/** Barre de taux de présence + pourcentage (« – » sans convocation). */
export function AttendanceBar({
  rate,
  compact = false,
}: {
  rate: number | null;
  compact?: boolean;
}) {
  return (
    <span
      className={styles.root}
      data-tone={attendanceTone(rate)}
      data-compact={compact ? "true" : undefined}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ width: `${rate ?? 0}%` }} />
      </span>
      <span className={styles.value}>{rate === null ? "–" : `${rate} %`}</span>
    </span>
  );
}
