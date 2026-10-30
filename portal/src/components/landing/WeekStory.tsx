"use client";

import { BrowserFrame } from "./BrowserFrame";
import { LandingTabs } from "./LandingTabs";
import { PhoneFrame } from "./PhoneFrame";
import section from "./LandingSection.module.css";
import styles from "./WeekStory.module.css";

type DayShot =
  | { kind: "phone"; src: string; alt: string; height?: number }
  | { kind: "desktop"; src: string; alt: string };

type Day = {
  key: string;
  short: string;
  long: string;
  moment: string;
  title: string;
  body: string;
  /** Ce qui part sans intervention humaine. */
  auto: string;
  shot: DayShot;
};

/** Une semaine type d'un club, calée sur les vrais horaires des notifications. */
const days: readonly Day[] = [
  {
    key: "dimanche",
    short: "Dim.",
    long: "Dimanche",
    moment: "Dimanche, 18h30",
    title: "Chacun reçoit le programme de sa semaine",
    body: "Un récap par personne : les séances à venir et ce qui reste à répondre. Plus personne ne demande « c’est à quelle heure mercredi ? ».",
    auto: "Récap hebdomadaire",
    shot: {
      kind: "phone",
      src: "/landing/app-real-home.webp",
      alt: "Accueil de l’app ViroTeam : les trois prochains entraînements de l’USMV Volley-Ball avec les réponses présents, absents et en attente",
    },
  },
  {
    key: "lundi",
    short: "Lun.",
    long: "Lundi",
    moment: "Lundi, 19h",
    title: "Les cotisations se relancent toutes seules",
    body: "Les retardataires reçoivent un rappel. Le bureau voit d’un coup d’œil qui a payé, ce qui reste dû, et n’envoie aucun message.",
    auto: "Rappel de cotisation",
    shot: {
      kind: "desktop",
      src: "/landing/portal-fees-tracking.png",
      alt: "Suivi des cotisations dans l’espace club : statuts à payer, partiel et restes dus",
    },
  },
  {
    key: "mercredi",
    short: "Mer.",
    long: "Mercredi",
    moment: "Mercredi, jour J",
    title: "Le coach sait qui vient, sans avoir demandé",
    body: "Rappel 2 jours avant puis le jour même pour ceux qui n’ont pas répondu. Chacun répond en un tap, pour lui ou pour son enfant. Résultat : 13 présents, 1 absent, 4 en attente.",
    auto: "Rappels J-2 et jour J",
    shot: {
      kind: "phone",
      src: "/landing/app-real-rsvp.webp",
      alt: "Réponses à un entraînement de l’USMV Volley-Ball : 13 présents, 1 absent, 4 en attente, avec les coachs en tête de liste",
      height: 1395,
    },
  },
  {
    key: "jeudi",
    short: "Jeu.",
    long: "Jeudi",
    moment: "Jeudi, imprévu",
    title: "Gymnase indisponible ? Tout le monde est prévenu",
    body: "Le coach modifie la séance de vendredi ou l’annule. Chaque membre concerné reçoit la notification, et le planning est à jour partout.",
    auto: "Notification de changement",
    shot: {
      kind: "phone",
      src: "/landing/app-real-planning-month.webp",
      alt: "Planning du club en vue mois : entraînements récurrents chaque mercredi et vendredi",
    },
  },
  {
    key: "septembre",
    short: "Sept.",
    long: "En septembre",
    moment: "Une seule fois, en début de saison",
    title: "Et tout ça, vous l’avez configuré une fois",
    body: "Créneaux récurrents jusqu’en juin, équipes, invitations, tarifs : 15 minutes depuis l’espace club. Le reste de la saison tourne tout seul.",
    auto: "Toute la saison",
    shot: {
      kind: "desktop",
      src: "/landing/portal-members-teams.png",
      alt: "Composition des équipes par catégorie dans l’espace club, avec coachs et joueurs",
    },
  },
];

/** Récit « une semaine avec ViroTeam » : un onglet par moment, une vraie capture. */
export function WeekStory() {
  return (
    <section
      id="semaine"
      className={`${section.section} ${section.tinted}`}
      aria-labelledby="week-title"
    >
      <div className={section.inner}>
        <header className={section.header}>
          <span className={section.eyebrow}>Une semaine avec ViroTeam</span>
          <h2 id="week-title" className={section.title}>
            Pendant que l’app relance, vous entraînez
          </h2>
          <p className={section.lead}>
            Ce qui se passe chaque semaine dans un club équipé, sans que
            personne n’ait à y penser.
          </p>
        </header>

        <LandingTabs
          ariaLabel="Jours de la semaine"
          tabs={days.map((day) => ({
            key: day.key,
            label: day.short,
            ariaLabel: day.long,
            content: <DayPanel day={day} />,
          }))}
        />
      </div>
    </section>
  );
}

function DayPanel({ day }: { day: Day }) {
  const desktop = day.shot.kind === "desktop";
  return (
    <div className={`${styles.panel} ${desktop ? styles.panelDesktop : ""}`.trim()}>
      <div className={styles.copy}>
        <p className={styles.moment}>{day.moment}</p>
        <h3 className={styles.title}>{day.title}</h3>
        <p className={styles.body}>{day.body}</p>
        <p className={styles.auto}>
          <span className={styles.autoDot} aria-hidden="true" />
          Automatique : {day.auto}
        </p>
      </div>
      <div className={styles.visual}>
        {day.shot.kind === "phone" ? (
          <PhoneFrame
            src={day.shot.src}
            alt={day.shot.alt}
            height={day.shot.height}
            className={styles.phone}
            sizes="(max-width: 899px) 70vw, 17rem"
          />
        ) : (
          <BrowserFrame src={day.shot.src} alt={day.shot.alt} />
        )}
      </div>
    </div>
  );
}
