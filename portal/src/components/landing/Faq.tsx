import styles from "./Faq.module.css";

const questions = [
  {
    question: "ViroTeam, c’est quoi ?",
    answer:
      "Une app pour organiser le club : planning, convocations et suivi des cotisations. Le bureau pilote ; membres et parents suivent simplement. Un compte peut rejoindre plusieurs clubs.",
  },
  {
    question: "Comment organiser le planning du club ?",
    answer:
      "Le coach ou l’admin crée séances et matchs, filtre par équipe ou coach, et suit les réponses aux convocations. Membres et parents voient le même calendrier dans l’app.",
  },
  {
    question: "Comment gérer les membres et les équipes ?",
    answer:
      "Le bureau suit licences et invitations, filtre l’effectif, et compose les équipes par catégorie avec joueurs et coachs. Parents et membres rejoignent le club sur invitation.",
  },
  {
    question: "Comment suivre les cotisations ?",
    answer:
      "Le bureau configure la saison et les tarifs, puis suit qui a payé et les restes dus. Un rappel par e-mail groupé est possible depuis le suivi ; parents et membres voient montant et échéance.",
  },
  {
    question: "Peut-on gérer plusieurs clubs ?",
    answer:
      "Oui. Avec un même compte, vous pouvez appartenir à plusieurs clubs (multiclub) et basculer facilement entre eux.",
  },
] as const;

/** FAQ publique : contenu indexable + mêmes questions que le JSON-LD. */
export function Faq() {
  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Questions</span>
          <h2 id="faq-title" className={styles.title}>
            Questions fréquentes
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
