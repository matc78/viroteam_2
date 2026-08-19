"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { StoreBadges } from "@/components/StoreBadges";
import { site } from "@/lib/site";
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

/** Premier viewport : marque dominante, promesse, CTA stores, visuel téléphone. */
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-brand">
      <div className={styles.content}>
        <motion.p
          className={styles.brand}
          custom={0.05}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <Image
            src={site.logoStacked}
            alt=""
            width={277}
            height={237}
            className={styles.brandLogo}
            priority
          />
        </motion.p>

        <motion.h1
          id="hero-brand"
          className={styles.headline}
          custom={0.18}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <span className="sr-only">{site.name}. </span>
          {site.tagline}
        </motion.h1>

        <motion.p
          className={styles.support}
          custom={0.28}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          Application de gestion de club sportif, invitation uniquement.
          Planning, convocations RSVP et cotisations pour clubs de football,
          joueurs, coachs, parents et admins.
        </motion.p>

        <motion.div
          className={styles.actions}
          custom={0.4}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <StoreBadges />
          <Link href="/login" className={styles.clubLink}>
            Accéder à l&apos;espace club
          </Link>
        </motion.div>
      </div>

      <motion.div
        className={styles.phoneWrap}
        aria-hidden="true"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.25, ease: easeOut }}
      >
        <div className={styles.phone}>
          <Image
            src="/landing/app-welcome.png"
            alt="Écran d'accueil ViroTeam sur mobile"
            width={390}
            height={844}
            className={styles.phoneImage}
            priority
          />
        </div>
      </motion.div>
    </section>
  );
}
