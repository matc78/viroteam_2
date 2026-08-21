"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./FeatureShowcase.module.css";

export type FeatureShowcaseShot = {
  src: string;
  alt: string;
  /** Libellé court sous la capture (optionnel). */
  caption?: string;
};

export type FeatureShowcaseProps = {
  id?: string;
  eyebrow: string;
  title: string;
  titleId: string;
  lead: string;
  bullets: readonly string[];
  screenshots: readonly FeatureShowcaseShot[];
  /** Inverse texte / captures sur desktop. */
  reverse?: boolean;
};

const easeOut = [0.22, 1, 0.36, 1] as const;

/** Bloc produit : pain point → solution → capture(s) desktop. */
export function FeatureShowcase({
  id,
  eyebrow,
  title,
  titleId,
  lead,
  bullets,
  screenshots,
  reverse = false,
}: FeatureShowcaseProps) {
  const reduceMotion = useReducedMotion();
  const multiShot = screenshots.length > 1;

  return (
    <section
      id={id}
      className={styles.section}
      aria-labelledby={titleId}
    >
      <div
        className={`${styles.inner} ${reverse ? styles.reverse : ""}`.trim()}
      >
        <div className={styles.copy}>
          <div className={styles.header}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <p className={styles.lead}>{lead}</p>
          </div>

          <ul className={styles.bullets}>
            {bullets.map((bullet, index) => (
              <motion.li
                key={bullet}
                className={styles.bullet}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{
                  duration: 0.4,
                  delay: reduceMotion ? 0 : index * 0.06,
                  ease: easeOut,
                }}
              >
                {bullet}
              </motion.li>
            ))}
          </ul>
        </div>

        <div
          className={`${styles.shots} ${multiShot ? styles.shotsStack : ""}`.trim()}
          aria-label="Captures d'écran produit"
        >
          {screenshots.map((shot, index) => (
            <motion.figure
              key={shot.src}
              className={styles.shot}
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.5,
                delay: reduceMotion ? 0 : index * 0.1,
                ease: easeOut,
              }}
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                width={1440}
                height={900}
                className={styles.shotImage}
                sizes="(max-width: 899px) 100vw, 52vw"
              />
              {shot.caption ? (
                <figcaption className={styles.caption}>{shot.caption}</figcaption>
              ) : null}
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
