"use client";

import { motion, useReducedMotion } from "framer-motion";
import styles from "./Features.module.css";

const features = [
  {
    title: "Planning & RSVP",
    body: "Créez les entraînements et matchs, suivez les réponses en temps réel et gardez tout le monde aligné.",
  },
  {
    title: "Cotisations HelloAsso",
    body: "Paiement simple pour les membres, suivi clair pour le bureau — sans tableur parallèle.",
  },
  {
    title: "Invitations & équipes",
    body: "Rejoindre un club uniquement sur invitation. Organisez joueurs et coachs par équipe.",
  },
  {
    title: "Annonces & calendrier",
    body: "Diffusez l'essentiel au club et synchronisez les événements avec le calendrier du téléphone.",
  },
] as const;

/** Section modules principaux — layout éditorial, pas de grille de cards. */
export function Features() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="fonctionnalites"
      className={styles.section}
      aria-labelledby="features-title"
    >
      <div className={styles.header}>
        <span className={styles.eyebrow}>Fonctionnalités</span>
        <h2 id="features-title" className={styles.title}>
          Ce qui compte pour un club
        </h2>
        <p className={styles.lead}>
          Du terrain au bureau : les outils du quotidien, sans friction.
        </p>
      </div>

      <ol className={styles.list}>
        {features.map((feature, index) => (
          <motion.li
            key={feature.title}
            className={styles.item}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 0.45,
              delay: reduceMotion ? 0 : index * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <span className={styles.index}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className={styles.itemTitle}>{feature.title}</h3>
            <p className={styles.itemBody}>{feature.body}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
