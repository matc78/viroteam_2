import { landingFaq } from "@/lib/seo";
import styles from "./Faq.module.css";

/** FAQ publique : contenu indexable + mêmes questions que le JSON-LD. */
export function Faq() {
  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Questions</span>
          <h2 id="faq-title" className={styles.title}>
            Questions sur l’app de gestion de club
          </h2>
        </header>
        <dl className={styles.list}>
          {landingFaq.map((item) => (
            <div key={item.question} className={styles.item}>
              <dt className={styles.question}>{item.question}</dt>
              <dd className={styles.answer}>{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
