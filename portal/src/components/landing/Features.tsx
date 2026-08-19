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
    body: "Les membres paient leur cotisation depuis l'app. Le bureau suit les paiements, sans tableur parallèle.",
  },
  {
    title: "Invitations et équipes",
    body: "Rejoindre un club uniquement sur invitation. Organisez joueurs et coachs par équipe.",
  },
  {
    title: "Annonces et calendrier",
    body: "Diffusez l'essentiel au club et synchronisez les événements avec le calendrier du téléphone.",
  },
] as const;

const screenshots = [
  { src: "/landing/app-club-dashboard.png", alt: "Dashboard club ViroTeam" },
  { src: "/landing/app-planning.png", alt: "Planning ViroTeam" },
  { src: "/landing/app-home-player.png", alt: "Accueil joueur ViroTeam" },
] as const;

/** Section fonctionnalités — texte + pyramide de 3 captures app. */
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

        <div
          className={styles.pyramid}
          aria-label="Captures d'écran de l'application"
        >
          {screenshots.map((shot, index) => (
            <motion.figure
              key={shot.src}
              className={styles.phoneFrame}
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.5,
                delay: reduceMotion ? 0 : index * 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                width={390}
                height={844}
                className={styles.phoneImage}
              />
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
