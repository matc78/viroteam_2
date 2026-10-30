"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { StoreBadges } from "@/components/StoreBadges";
import { site } from "@/lib/site";
import { PhoneFrame } from "./PhoneFrame";
import { SectionConfetti } from "./SectionConfetti";
import styles from "./Hero.module.css";

const easeOut = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay, ease: easeOut },
  }),
};

/**
 * Premier viewport : promesse « configurez une fois », CTA principal pour le
 * bureau (créer le club), stores en second pour joueurs et parents.
 */
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-brand">
      <SectionConfetti preset="a" />
      <div className={styles.inner}>
        <div className={styles.content}>
          <motion.p
            className={styles.badge}
            custom={0.05}
            variants={fadeUp}
            initial="hidden"
            animate="show"
          >
            <span className={styles.badgeTag}>Bêta</span>
            Gratuit pour les clubs pendant la bêta
          </motion.p>

          <motion.h1
            id="hero-brand"
            className={styles.headline}
            custom={0.12}
            variants={fadeUp}
            initial="hidden"
            animate="show"
          >
            <span className="sr-only">{site.name}. </span>
            Configurez votre saison une fois.{" "}
            <span className={styles.headlineAccent}>
              ViroTeam s&apos;occupe du reste.
            </span>
          </motion.h1>

          <motion.p
            className={styles.support}
            custom={0.22}
            variants={fadeUp}
            initial="hidden"
            animate="show"
          >
            Convocations, rappels, présences, annonces et cotisations partent
            tout seuls, toute la saison. Vos coachs arrêtent de relancer et
            retournent sur le terrain.
          </motion.p>

          <motion.div
            className={styles.actions}
            custom={0.32}
            variants={fadeUp}
            initial="hidden"
            animate="show"
          >
            <Link href="/signup?intent=founder" className={styles.primary}>
              Créer mon club gratuitement
            </Link>
            <Link href="/login" className={styles.secondary}>
              Accéder à l&apos;espace club
            </Link>
          </motion.div>

          <motion.div
            className={styles.members}
            custom={0.42}
            variants={fadeUp}
            initial="hidden"
            animate="show"
          >
            <p className={styles.membersLabel}>
              Joueur ou parent ? Votre club vous a invité : téléchargez l&apos;app.
            </p>
            <StoreBadges className={styles.stores} />
          </motion.div>
        </div>

        <motion.div
          className={styles.phones}
          aria-hidden="true"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: easeOut }}
        >
          <PhoneFrame
            src="/landing/app-real-club.webp"
            alt=""
            className={styles.phoneBack}
            sizes="(max-width: 899px) 45vw, 17rem"
          />
          <PhoneFrame
            src="/landing/app-real-home.webp"
            alt=""
            className={styles.phoneFront}
            sizes="(max-width: 899px) 55vw, 19rem"
            priority
          />
          <p className={styles.proof}>
            <span className={styles.proofDot} />
            Club réel : USMV Volley-Ball, Viroflay
          </p>
        </motion.div>
      </div>
    </section>
  );
}
