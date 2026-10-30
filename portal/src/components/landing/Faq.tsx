import { landingFaq } from "@/lib/seo";
import { site } from "@/lib/site";
import { SectionConfetti } from "./SectionConfetti";
import section from "./LandingSection.module.css";
import styles from "./Faq.module.css";

/** FAQ publique : contenu indexable + mêmes questions que le JSON-LD. */
export function Faq() {
  return (
    <section id="faq" className={section.section} aria-labelledby="faq-title">
      <SectionConfetti preset="d" />
      <div className={`${section.inner} ${styles.layout}`}>
        <header className={`${section.header} ${styles.header}`}>
          <span className={section.eyebrow}>Questions</span>
          <h2 id="faq-title" className={section.title}>
            Les questions qu’on nous pose
          </h2>
          <p className={section.lead}>
            Une autre question ? ViroTeam est développé par une seule
            personne pour l’instant : écrivez-moi directement à{" "}
            <a className={styles.mail} href={`mailto:${site.contactEmail}`}>
              {site.contactEmail}
            </a>
            , je réponds moi-même.
          </p>
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
