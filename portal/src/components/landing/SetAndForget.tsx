"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./SetAndForget.module.css";

const easeOut = [0.22, 1, 0.36, 1] as const;

const chores = [
  "Recréer l’entraînement chaque semaine",
  "Relancer le groupe WhatsApp et compter les pouces",
  "Rappeler la veille ceux qui n’ont pas répondu",
  "Prévenir un par un d’un changement de salle",
  "Courir après les cotisations",
] as const;

const setupSteps = [
  "Créez vos équipes et invitez membres et parents par code",
  "Posez vos créneaux récurrents : « mercredi et vendredi 20h30, gymnase, jusqu’en juin »",
  "Fixez les tarifs de cotisation de la saison",
] as const;

/** Icônes trait simples (24×24, `currentColor`). */
const icons: Record<string, ReactNode> = {
  send: <path d="M4 12 20 4l-6 16-3-7-7-1Z" />,
  bell: (
    <>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  check: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  swap: (
    <>
      <path d="M4 8h13l-3-3" />
      <path d="M20 16H7l3 3" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4h3l7 4V6l-7 4H4Z" />
      <path d="M18 9a4 4 0 0 1 0 6" />
    </>
  ),
  euro: (
    <>
      <path d="M17 6.5A7 7 0 1 0 17 17.5" />
      <path d="M5 10.5h8M5 13.5h8" />
    </>
  ),
};

const automations = [
  {
    icon: "send",
    title: "Convocations envoyées",
    body: "Chaque séance de la série est notifiée aux bons joueurs, sans rien recréer.",
  },
  {
    icon: "bell",
    title: "Rappels automatiques",
    body: "2 jours avant et le jour J, plus une relance à 7 jours pour ceux qui n’ont pas répondu.",
  },
  {
    icon: "check",
    title: "Présences en direct",
    body: "Présents, absents, en attente : le coach voit l’effectif avant d’arriver.",
  },
  {
    icon: "swap",
    title: "Changements diffusés",
    body: "Nouvel horaire, nouvelle salle ou annulation : tout le monde est prévenu.",
  },
  {
    icon: "megaphone",
    title: "Annonces du club",
    body: "Une info pour tout le club ou une équipe, directement dans l’app.",
  },
  {
    icon: "euro",
    title: "Cotisations relancées",
    body: "Rappel hebdomadaire aux retardataires et récap du planning le dimanche soir.",
  },
] as const;

/** Cœur de la landing : la mise en place unique en début de saison, puis les automatismes. */
export function SetAndForget() {
  const reduceMotion = useReducedMotion();

  // `initial` identique serveur / client (sinon l'hydratation laisse opacity: 0) ;
  // le mouvement réduit coupe seulement la durée.
  const reveal = (index: number, axis: "x" | "y" = "y") => ({
    initial: { opacity: 0, [axis]: axis === "y" ? 14 : -12 },
    whileInView: { opacity: 1, x: 0, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: {
      duration: reduceMotion ? 0 : 0.45,
      delay: reduceMotion ? 0 : index * 0.06,
      ease: easeOut,
    },
  });

  return (
    <section
      id="automatique"
      className={styles.section}
      aria-labelledby="set-and-forget-title"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Fini les relances</span>
          <h2 id="set-and-forget-title" className={styles.title}>
            Une bonne mise en place en début de saison, et c’est réglé
          </h2>
          <p className={styles.lead}>
            Entraîner, c’est sur le terrain. Pas dans un groupe WhatsApp à
            compter qui vient.
          </p>
        </header>

        <div className={styles.compare}>
          <motion.div className={styles.before} {...reveal(0, "x")}>
            <h3 className={styles.compareTitle}>
              La semaine d’un coach, sans ViroTeam
            </h3>
            <ul className={styles.choreList}>
              {chores.map((chore) => (
                <li key={chore} className={styles.chore}>
                  {chore}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div className={styles.after} {...reveal(1, "x")}>
            <h3 className={styles.compareTitle}>Avec ViroTeam</h3>
            <p className={styles.afterBig}>Rien.</p>
            <p className={styles.afterStat}>0 relance manuelle</p>
            <p className={styles.afterBody}>
              Tout part automatiquement, toute la saison. Le coach consulte, il
              ne relance plus.
            </p>
          </motion.div>
        </div>

        <ol className={styles.timeline}>
          <li className={styles.stage}>
            <div className={styles.stageHead}>
              <span className={styles.stageNumber}>1</span>
              <div>
                <h3 className={styles.stageTitle}>
                  En début de saison, une seule fois
                </h3>
                <p className={styles.stageMeta}>
                  Environ 15 minutes, depuis l’espace club sur le web
                </p>
              </div>
            </div>
            <ul className={styles.setupList}>
              {setupSteps.map((step, index) => (
                <motion.li
                  key={step}
                  className={styles.setupItem}
                  {...reveal(index)}
                >
                  {step}
                </motion.li>
              ))}
            </ul>
          </li>

          <li className={styles.stage}>
            <div className={styles.stageHead}>
              <span className={`${styles.stageNumber} ${styles.stageNumberAuto}`}>
                2
              </span>
              <div>
                <h3 className={styles.stageTitle}>
                  Ensuite, ViroTeam s’occupe de tout
                </h3>
                <p className={styles.stageMeta}>
                  Pour chaque séance, de septembre à juin
                </p>
              </div>
            </div>

            <ul className={styles.autoGrid}>
              {automations.map((item, index) => (
                <motion.li
                  key={item.title}
                  className={styles.autoCard}
                  {...reveal(index)}
                >
                  <span className={styles.autoIcon} aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {icons[item.icon]}
                    </svg>
                  </span>
                  <h4 className={styles.autoTitle}>{item.title}</h4>
                  <p className={styles.autoBody}>{item.body}</p>
                </motion.li>
              ))}
            </ul>
          </li>
        </ol>
      </div>
    </section>
  );
}
