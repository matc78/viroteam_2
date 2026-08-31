"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./HowItWorks.module.css";

const steps = [
  {
    title: "Créez votre club sur le web",
    body: "Configurez le club en quelques minutes, puis invitez votre bureau.",
  },
  {
    title: "Invitez les membres",
    body: "Partagez un code d’invitation — pas d’inscription ouverte au hasard.",
  },
  {
    title: "Pilotez le quotidien",
    body: "Planning, réponses aux convocations et suivi des cotisations — visibles aussi pour membres et parents.",
  },
] as const;

/** Parcours en 3 étapes — texte à gauche, photo équipe à droite. */
export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="demarrer" className={styles.section} aria-labelledby="how-title">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Démarrer</span>
            <h2 id="how-title" className={styles.title}>
              Comment ça marche
            </h2>
            <p className={styles.lead}>
              Trois étapes pour que le bureau organise et que tout le monde
              suive — y compris sur plusieurs clubs.
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
        </div>

        <motion.figure
          className={styles.photo}
          initial={reduceMotion ? false : { opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={styles.imageWrap}>
            <Image
              src="/landing/youth-club.jpg"
              alt="Jeunes d’un club autour de leur coach après un match"
              fill
              sizes="(max-width: 900px) 100vw, 42vw"
              className={styles.image}
            />
          </div>
          <figcaption className={styles.caption}>En équipe</figcaption>
        </motion.figure>
      </div>
    </section>
  );
}
