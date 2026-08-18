import styles from "./Faq.module.css";

const questions = [
  {
    question: "ViroTeam, c’est quoi ?",
    answer:
      "Une application de gestion de club sportif : planning des entraînements et matchs, convocations RSVP, cotisations HelloAsso, équipes et communication. Pensée pour le football et les sports collectifs.",
  },
  {
    question: "Comment gérer le planning et les convocations ?",
    answer:
      "Le coach ou l’admin crée les séances et les matchs, envoie les convocations, et suit les réponses (présent, absent, peut-être) en temps réel — sans groupe WhatsApp.",
  },
  {
    question: "Peut-on encaisser les cotisations du club ?",
    answer:
      "Oui. Les membres paient via HelloAsso depuis l’app. Le bureau voit qui est à jour, sans tableur parallèle.",
  },
  {
    question: "Qui peut utiliser l’application ?",
    answer:
      "Joueurs, coachs, parents et administrateurs. L’accès se fait uniquement sur invitation : pas d’inscription ouverte au public.",
  },
] as const;

/** FAQ publique : contenu indexable + mêmes questions que le JSON-LD. */
export function Faq() {
  return (
    <section className={styles.section} aria-labelledby="faq-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Questions</span>
          <h2 id="faq-title" className={styles.title}>
            Questions fréquentes sur la gestion de club
          </h2>
        </header>
        <dl className={styles.list}>
          {questions.map((item) => (
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
