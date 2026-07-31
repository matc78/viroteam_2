"use client";

import { motion, useReducedMotion } from "framer-motion";
import styles from "./HowItWorks.module.css";

const steps = [
  {
    title: "Créez votre club",
    body: "Configurez le club en quelques minutes et invitez votre bureau.",
  },
  {
    title: "Invitez les membres",
    body: "Partagez un code d’invitation — pas d’inscription ouverte au hasard.",
  },
  {
    title: "Pilotez le quotidien",
    body: "Planning, RSVP et cotisations au même endroit, pour tout le club.",
  },
] as const;

/** Parcours en 3 étapes. */
export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section className={styles.section} aria-labelledby="how-title">
      <div className={styles.header}>
        <span className={styles.eyebrow}>Démarrer</span>
        <h2 id="how-title" className={styles.title}>
          Comment ça marche
        </h2>
        <p className={styles.lead}>
          Trois étapes pour passer du chaos WhatsApp à un club organisé.
        </p>
      </div>

      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <motion.li
            key={step.title}
            className={styles.step}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: 0.45,
              delay: reduceMotion ? 0 : index * 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepBody}>{step.body}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
