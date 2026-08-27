"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./Roles.module.css";

const roles = [
  {
    name: "Joueur",
    desc: "Voir le planning, répondre aux convocations, suivre sa cotisation.",
    color: "var(--color-role-player)",
  },
  {
    name: "Coach",
    desc: "Gérer l’équipe, les événements et les réponses aux convocations.",
    color: "var(--color-role-coach)",
  },
  {
    name: "Parent",
    desc: "Calendrier de l’enfant et statut de cotisation, sans solliciter le coach.",
    color: "var(--color-role-parent)",
  },
  {
    name: "Admin",
    desc: "Piloter planning et cotisations depuis l’espace club.",
    color: "var(--color-role-admin)",
  },
] as const;

/** Section rôles — photo tribunes à gauche, liste à droite. */
export function Roles() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="roles" className={styles.section} aria-labelledby="roles-title">
      <div className={styles.inner}>
        <motion.figure
          className={styles.photo}
          initial={reduceMotion ? false : { opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={styles.imageWrap}>
            <Image
              src="/landing/parents-stands.jpg"
              alt="Jeune joueuse devant les tribunes où les parents suivent le match"
              fill
              sizes="(max-width: 900px) 100vw, 42vw"
              className={styles.image}
            />
          </div>
          <figcaption className={styles.caption}>En tribune</figcaption>
        </motion.figure>

        <div className={styles.copy}>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Rôles</span>
            <h2 id="roles-title" className={styles.title}>
              Chacun suit le club simplement
            </h2>
            <p className={styles.lead}>
              Un compte, les bons droits — et plusieurs clubs si besoin
              (multiclub).
            </p>
          </div>

          <ul className={styles.list}>
            {roles.map((role, index) => (
              <motion.li
                key={role.name}
                className={styles.item}
                initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: 0.4,
                  delay: reduceMotion ? 0 : index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <span
                  className={styles.dot}
                  style={{ background: role.color }}
                  aria-hidden="true"
                />
                <span className={styles.role}>{role.name}</span>
                <p className={styles.desc}>{role.desc}</p>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
