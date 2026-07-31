"use client";

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
    desc: "Gérer l’équipe, les événements et les présences sur le terrain.",
    color: "var(--color-role-coach)",
  },
  {
    name: "Parent",
    desc: "Suivre le planning et les informations liées au compte de l’enfant.",
    color: "var(--color-role-parent)",
  },
  {
    name: "Admin",
    desc: "Piloter le club : membres, cotisations, invitations et configuration.",
    color: "var(--color-role-admin)",
  },
] as const;

/** Section multi-rôles avec pastilles couleur tokens app. */
export function Roles() {
  const reduceMotion = useReducedMotion();

  return (
    <section className={styles.section} aria-labelledby="roles-title">
      <div className={styles.header}>
        <span className={styles.eyebrow}>Rôles</span>
        <h2 id="roles-title" className={styles.title}>
          Un compte, tous les rôles
        </h2>
        <p className={styles.lead}>
          Chacun voit ce dont il a besoin — sans multiplier les outils.
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
    </section>
  );
}
