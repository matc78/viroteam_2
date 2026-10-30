import styles from "./StatsBand.module.css";

/** Chiffres réels de l'USMV Volley-Ball (captures d'octobre 2026). */
const stats = [
  {
    value: "0",
    label: "relance manuelle",
    detail: "Rappels, présences et cotisations : tout est automatique",
    highlight: true,
  },
  {
    value: "2",
    label: "entraînements par semaine",
    detail: "Posés une seule fois pour toute la saison",
  },
  {
    value: "13",
    label: "présents confirmés",
    detail: "Le coach le sait avant d’arriver au gymnase",
  },
  {
    value: "19",
    label: "membres",
    detail: "Joueurs, coachs et bureau dans la même app",
  },
] as const;

/** Bande de preuve sous le hero : chiffres d'un vrai club en activité. */
export function StatsBand() {
  return (
    <section className={styles.band} aria-labelledby="stats-title">
      <div className={styles.inner}>
        <h2 id="stats-title" className={styles.title}>
          Cette saison à l’USMV Volley-Ball (Viroflay)
        </h2>
        <dl className={styles.grid}>
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`${styles.stat} ${"highlight" in stat ? styles.statHighlight : ""}`.trim()}
            >
              <dt className={styles.label}>
                <span className={styles.value}>{stat.value}</span>
                {stat.label}
              </dt>
              <dd className={styles.detail}>{stat.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
