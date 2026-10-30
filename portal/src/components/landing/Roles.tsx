"use client";

import { BrowserFrame } from "./BrowserFrame";
import { LandingTabs } from "./LandingTabs";
import { PhoneFrame } from "./PhoneFrame";
import { SectionConfetti } from "./SectionConfetti";
import section from "./LandingSection.module.css";
import styles from "./Roles.module.css";

type Role = {
  key: string;
  name: string;
  color: string;
  pitch: string;
  points: readonly string[];
  shot:
    | { kind: "phone"; src: string; alt: string; height?: number }
    | { kind: "desktop"; src: string; alt: string };
};

const roles: readonly Role[] = [
  {
    key: "joueur",
    name: "Joueur",
    color: "var(--color-role-player)",
    pitch: "Je sais où et quand, je réponds en un tap.",
    points: [
      "Le planning de ses équipes, toujours à jour",
      "Présent ou absent en un tap, rappels inclus",
      "Sa cotisation : montant, échéance, paiement par carte",
    ],
    shot: {
      kind: "phone",
      src: "/landing/app-real-home.webp",
      alt: "Accueil joueur dans l’app ViroTeam : prochains entraînements et réponses",
    },
  },
  {
    key: "coach",
    name: "Coach",
    color: "var(--color-role-coach)",
    pitch: "Je vois qui vient, je ne relance plus.",
    points: [
      "Présents, absents et en attente en direct",
      "Séances créées ou modifiées, équipe prévenue",
      "Annonces envoyées à son équipe",
    ],
    shot: {
      kind: "phone",
      src: "/landing/app-real-rsvp.webp",
      alt: "Vue coach : liste des réponses à un entraînement avec 13 présents",
      height: 1395,
    },
  },
  {
    key: "parent",
    name: "Parent",
    color: "var(--color-role-parent)",
    pitch: "Je suis mes enfants sans harceler le coach.",
    points: [
      "Le planning de chaque enfant, même dans plusieurs clubs",
      "Réponse aux convocations à la place de l’enfant",
      "Cotisation réglée en ligne, reçu à la clé",
    ],
    shot: {
      kind: "phone",
      src: "/landing/app-real-planning-month.webp",
      alt: "Planning du club en vue mois dans l’app ViroTeam",
    },
  },
  {
    key: "bureau",
    name: "Bureau",
    color: "var(--color-role-admin)",
    pitch: "Je configure une fois, je pilote d’un coup d’œil.",
    points: [
      "Membres, licences, équipes et invitations",
      "Planning de la saison et tarifs de cotisation",
      "Suivi des paiements et des restes dus",
    ],
    shot: {
      kind: "desktop",
      src: "/landing/portal-members-roster.png",
      alt: "Liste des membres de l’espace club, avec rôles et invitations",
    },
  },
];

/** Rôles : un onglet par profil, avec ce qu'il fait et la capture associée. */
export function Roles() {
  return (
    <section id="roles" className={section.section} aria-labelledby="roles-title">
      <SectionConfetti preset="c" />
      <div className={section.inner}>
        <header className={section.header}>
          <span className={section.eyebrow}>Pour tout le club</span>
          <h2 id="roles-title" className={section.title}>
            Chacun voit ce qui le concerne, rien de plus
          </h2>
          <p className={section.lead}>
            Des droits adaptés à chaque rôle, sur invitation uniquement. Un
            même compte peut suivre plusieurs clubs.
          </p>
        </header>

        <LandingTabs
          ariaLabel="Rôles"
          tabs={roles.map((role) => ({
            key: role.key,
            label: (
              <>
                <span
                  className={styles.dot}
                  style={{ background: role.color }}
                  aria-hidden="true"
                />
                {role.name}
              </>
            ),
            ariaLabel: role.name,
            content: (
              <div
                className={`${styles.panel} ${role.shot.kind === "desktop" ? styles.panelDesktop : ""}`.trim()}
                style={{ ["--role-color" as string]: role.color }}
              >
                <div className={styles.copy}>
                  <p className={styles.pitch}>« {role.pitch} »</p>
                  <ul className={styles.points}>
                    {role.points.map((point) => (
                      <li key={point} className={styles.point}>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={styles.visual}>
                  {role.shot.kind === "phone" ? (
                    <PhoneFrame
                      src={role.shot.src}
                      alt={role.shot.alt}
                      height={role.shot.height}
                      className={styles.phone}
                      sizes="(max-width: 899px) 60vw, 15rem"
                    />
                  ) : (
                    <BrowserFrame src={role.shot.src} alt={role.shot.alt} />
                  )}
                </div>
              </div>
            ),
          }))}
        />
      </div>
    </section>
  );
}
