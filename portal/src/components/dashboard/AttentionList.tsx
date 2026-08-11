import type { AttentionItem } from "@/lib/dashboard/mockHome";
import styles from "./AttentionList.module.css";

type AttentionListProps = {
  items: AttentionItem[];
};

/** Liste des alertes bureau à traiter (cotisations, aides, RSVP). */
export function AttentionList({ items }: AttentionListProps) {
  return (
    <section className={styles.panel} aria-labelledby="attention-title">
      <header className={styles.header}>
        <h2 id="attention-title" className={styles.title}>
          À traiter
        </h2>
        <p className={styles.subtitle}>Priorités admin cette semaine</p>
      </header>

      <ul className={styles.list}>
        {items.map((item) => (
          <li
            key={item.id}
            className={`${styles.item} ${styles[item.severity]}`}
          >
            <span className={styles.dot} aria-hidden="true" />
            <div className={styles.content}>
              <p className={styles.itemTitle}>{item.title}</p>
              <p className={styles.detail}>{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
