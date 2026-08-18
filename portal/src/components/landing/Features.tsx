"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./Features.module.css";

const features = [
  {
    title: "Planning, matchs et convocations RSVP",
    body: "Créez les entraînements et matchs, envoyez les convocations, suivez les présences en temps réel.",
  },
  {
    title: "Cotisations HelloAsso",
    body: "Les membres paient leur cotisation depuis l’app. Le bureau suit les paiements, sans tableur parallèle.",
  },
  {
    title: "Invitations et équipes",
    body: "Rejoindre un club uniquement sur invitation. Organisez joueurs et coachs par équipe.",
  },
  {
    title: "Annonces et calendrier",
    body: "Diffusez l’essentiel au club et synchronisez les événements avec le calendrier du téléphone.",
  },
] as const;

/** Section modules — texte à gauche, photo terrain à droite. */
export function Features() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="fonctionnalites"
      className={styles.section}
      aria-labelledby="features-title"
    >
      <div className={styles.inner}>
        <div className={styles.copy}>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Fonctionnalités</span>
            <h2 id="features-title" className={styles.title}>
              Ce qui compte pour un club sportif
            </h2>
            <p className={styles.lead}>
              Du terrain au bureau : planning, convocations, cotisations et
              équipes — sans tableur ni groupe WhatsApp.
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
                <div>
                  <h3 className={styles.itemTitle}>{feature.title}</h3>
                  <p className={styles.itemBody}>{feature.body}</p>
                </div>
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
              src="/landing/youth-playing.jpg"
              alt="Jeune joueur en action sur le terrain du club"
              fill
              sizes="(max-width: 900px) 100vw, 42vw"
              className={styles.image}
            />
          </div>
          <figcaption className={styles.caption}>Sur le terrain</figcaption>
        </motion.figure>
      </div>
    </section>
  );
}
