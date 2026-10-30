"use client";

import { BrowserFrame } from "./BrowserFrame";
import { LandingTabs } from "./LandingTabs";
import { SectionConfetti } from "./SectionConfetti";
import section from "./LandingSection.module.css";
import styles from "./BureauSpace.module.css";

const tools = [
  {
    key: "membres",
    label: "Membres",
    title: "L’effectif à jour, sans tableur",
    points: [
      "Rôles, équipes, licences et inscriptions",
      "Invitations envoyées ou copiées en un clic",
      "Import et export CSV",
    ],
    src: "/landing/portal-members-roster.png",
    alt: "Liste des membres de l’espace club avec rôles, équipes, licences et invitations",
  },
  {
    key: "equipes",
    label: "Équipes",
    title: "Les équipes par catégorie, en un coup d’œil",
    points: [
      "Coachs et joueurs par équipe",
      "Regroupement par catégorie (M11, M15, Seniors…)",
      "Un joueur peut être dans plusieurs équipes",
    ],
    src: "/landing/portal-members-teams.png",
    alt: "Composition des équipes par catégorie avec coachs et joueurs",
  },
  {
    key: "cotisations",
    label: "Cotisations",
    title: "Qui a payé, ce qui reste dû",
    points: [
      "Tarifs de la saison, aides et exonérations",
      "Paiement en ligne par carte ou suivi hors ligne",
      "Rappel automatique chaque lundi aux retardataires",
    ],
    src: "/landing/portal-fees-tracking.png",
    alt: "Suivi des cotisations avec statuts et restes dus",
  },
  {
    key: "planning",
    label: "Planning",
    title: "Toute la saison sur un écran",
    points: [
      "Créneaux récurrents jusqu’à la fin de saison",
      "Filtres par équipe, coach et catégorie",
      "Matchs, tournois, réunions au même endroit",
    ],
    src: "/landing/portal-planning-week.png",
    alt: "Planning semaine de l’espace club avec filtres par équipe, coach et catégorie",
  },
] as const;

/** Espace club web du bureau : un onglet par outil, capture en grand. */
export function BureauSpace() {
  return (
    <section id="bureau" className={section.section} aria-labelledby="bureau-title">
      <SectionConfetti preset="b" />
      <div className={section.inner}>
        <header className={section.header}>
          <span className={section.eyebrow}>Côté bureau</span>
          <h2 id="bureau-title" className={section.title}>
            L’espace club sur le web pour tout mettre en place
          </h2>
          <p className={section.lead}>
            Le bureau configure depuis un ordinateur. Joueurs, coachs et
            parents profitent du résultat dans l’app.
          </p>
        </header>

        <LandingTabs
          ariaLabel="Outils de l’espace club"
          tabs={tools.map((tool) => ({
            key: tool.key,
            label: tool.label,
            content: (
              <div className={styles.panel}>
                <div className={styles.copy}>
                  <h3 className={styles.title}>{tool.title}</h3>
                  <ul className={styles.points}>
                    {tool.points.map((point) => (
                      <li key={point} className={styles.point}>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <BrowserFrame
                  src={tool.src}
                  alt={tool.alt}
                  className={styles.shot}
                  sizes="(max-width: 899px) 100vw, 50rem"
                />
              </div>
            ),
          }))}
        />
      </div>
    </section>
  );
}
