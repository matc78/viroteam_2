"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { StoreBadges } from "@/components/StoreBadges";
import styles from "./FinalCta.module.css";

/** Bandeau final : stores + espace club. */
export function FinalCta() {
  const reduceMotion = useReducedMotion();

  return (
    <section className={styles.section} aria-labelledby="final-cta-title">
      <motion.div
        className={styles.panel}
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 id="final-cta-title" className={styles.title}>
          Prêt à organiser votre club ?
        </h2>
        <p className={styles.lead}>
          Téléchargez ViroTeam sur Android. L’App Store arrive bientôt. Les
          admins pourront bientôt piloter le bureau depuis le web.
        </p>
        <div className={styles.actions}>
          <StoreBadges />
          <Link href="/login" className={styles.clubLink}>
            Espace club
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
