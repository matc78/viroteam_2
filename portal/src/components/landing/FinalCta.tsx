"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { StoreBadges } from "@/components/StoreBadges";
import styles from "./FinalCta.module.css";

/** Bandeau final : stores + espace club, cadre coloré et formes. */
export function FinalCta() {
  const reduceMotion = useReducedMotion();

  return (
    <section className={styles.section} aria-labelledby="final-cta-title">
      <motion.div
        className={styles.frame}
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.frameInner}>
          <div className={styles.panel}>
            <div className={styles.shapes} aria-hidden="true">
              <span className={styles.blobOrange} />
              <span className={styles.blobCyan} />
              <span className={styles.blobGreen} />
              <span className={styles.ring} />
              <span className={styles.dotYellow} />
              <span className={styles.dotBlue} />
              <span className={styles.arc} />
            </div>

            <div className={styles.content}>
              <h2 id="final-cta-title" className={styles.title}>
                Bureau et parents, sur la même page
              </h2>
              <p className={styles.lead}>
                Téléchargez ViroTeam sur Android — l’App Store arrive bientôt.
                Organisez un ou plusieurs clubs depuis le web et l’app.
              </p>
              <div className={styles.actions}>
                <StoreBadges />
                <Link href="/signup?intent=founder" className={styles.clubLink}>
                  Créer mon club
                </Link>
                <Link href="/login" className={styles.clubLink}>
                  Espace club
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
