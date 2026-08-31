import { ClubSetupUi } from "@/lib/clubSetup/clubSetupUi";
import styles from "./PrerequisitesStep.module.css";

const ITEMS = [
  { icon: "👥", title: "Nom et sport du club", subtitle: "Comme vos membres vous connaissent" },
  { icon: "📍", title: "Ville et lieu de pratique", subtitle: "Stade, salle, gymnase…" },
  { icon: "🖼", title: "Logo (optionnel)", subtitle: "Ajoutable ou modifiable plus tard" },
  { icon: "📅", title: "Vos priorités", subtitle: "Planning, cotisations, annonces…" },
  { icon: "🛡", title: "Rôle administrateur", subtitle: "Invitez vos membres par code" },
] as const;

/** Étape 0 — ce qu’il faut savoir avant de créer un club. */
export function PrerequisitesStep() {
  return (
    <div className={styles.list}>
      {ITEMS.map((item, index) => {
        const accent = ClubSetupUi.prerequisiteAccents[index];
        const mirrored = index % 2 === 1;
        return (
          <div
            key={item.title}
            className={`${styles.bubbleRow} ${mirrored ? styles.bubbleRowRight : styles.bubbleRowLeft}`}
          >
            <article
              className={`${styles.bubble} ${mirrored ? styles.bubbleMirrored : ""}`}
              style={{ ["--bubble-accent" as string]: accent }}
            >
              <div className={styles.bubbleContent}>
                <span
                  className={styles.iconWrap}
                  style={{
                    background: `color-mix(in srgb, ${accent} 14%, white)`,
                    border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)`,
                  }}
                  aria-hidden
                >
                  {item.icon}
                </span>
                <div className={styles.textBlock}>
                  <h3 className={styles.bubbleTitle}>{item.title}</h3>
                  <p className={styles.bubbleSubtitle}>{item.subtitle}</p>
                </div>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
