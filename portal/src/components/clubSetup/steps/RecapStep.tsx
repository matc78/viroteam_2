import type { ClubSetupDraft } from "@/lib/clubSetup/clubSetupDraft";
import {
  ClubMemberCountRanges,
  ClubObjectives,
  PracticeLocationCategories,
} from "@/lib/clubSetup/constants";
import { ClubSetupFormat } from "@/lib/clubSetup/clubSetupFormat";
import { ClubSetupUi } from "@/lib/clubSetup/clubSetupUi";
import { sportEmoji } from "@/lib/sports/sportEmoji";
import { SetupCard } from "@/components/clubSetup/SetupCard";
import styles from "./RecapStep.module.css";

type RecapStepProps = {
  draft: ClubSetupDraft;
};

/** Étape récapitulatif — résumé avant création du club. */
export function RecapStep({ draft }: RecapStepProps) {
  const sportAccent = ClubSetupUi.sportAccent(draft.sport);
  const clubName = draft.name.trim() || "Nom du club";
  const headquartersCityLine = [draft.postalCode.trim(), draft.city.trim()]
    .filter(Boolean)
    .join(" ");
  const headquartersStreet = draft.address.trim();

  return (
    <div className={styles.layout}>
      <SetupCard
        accent={sportAccent}
        className={`${styles.sectionCard} ${styles.heroCard}`}
      >
        <div
          className={styles.logo}
          style={
            { ["--sport-accent" as string]: sportAccent } as React.CSSProperties
          }
        >
          {draft.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.logoDataUrl} alt="" />
          ) : (
            <span aria-hidden>{sportEmoji(draft.sport)}</span>
          )}
        </div>
        <div className={styles.heroCopy}>
          <h3 className={styles.heroTitle}>{clubName}</h3>
          <p className={styles.heroMeta} style={{ color: sportAccent }}>
            {sportEmoji(draft.sport)} {draft.sport}
            {draft.city ? ` · ${draft.city}` : ""}
          </p>
        </div>
      </SetupCard>

      <div className={styles.columns}>
        <SetupCard accent="var(--step-accent)" className={styles.sectionCard}>
          <h4 className={styles.panelTitle}>Localisation</h4>
          <div className={styles.locationColumns}>
            <div className={styles.locationBlock}>
              <p className={styles.locationEyebrow}>Siège</p>
              <div className={styles.hqCard}>
                {headquartersStreet ? (
                  <p className={styles.hqStreet}>{headquartersStreet}</p>
                ) : null}
                <p className={styles.hqCity}>
                  {headquartersCityLine ||
                    draft.city ||
                    "Ville non renseignée"}
                </p>
              </div>
            </div>

            {draft.practiceLocations.length > 0 ? (
              <div className={styles.locationBlock}>
                <p className={styles.locationEyebrow}>Lieux de pratique</p>
                <div className={styles.locationList}>
                  {draft.practiceLocations.map((location, index) => {
                    const categoryLabel = location.category
                      ? PracticeLocationCategories.label(
                          location.category,
                          location.categoryCustom,
                        )
                      : null;
                    const place = [location.city, location.address]
                      .map((part) => part?.trim())
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <article
                        key={`${location.name}-${index}`}
                        className={styles.locationItem}
                      >
                        {categoryLabel ? (
                          <span className={styles.locationCategory}>
                            {categoryLabel}
                          </span>
                        ) : null}
                        <span className={styles.locationPlace}>
                          {place || location.name}
                        </span>
                      </article>
                    );
                  })}
                </div>
                <p className={styles.locationSummary}>
                  {ClubSetupFormat.practiceLocationsSummary({
                    locations: draft.practiceLocations,
                    fallbackCity: draft.city,
                  })}
                </p>
              </div>
            ) : null}
          </div>
        </SetupCard>

        <SetupCard accent="var(--step-accent)" className={styles.sectionCard}>
          <h4 className={styles.panelTitle}>Priorités & effectif</h4>
          <div className={styles.chips}>
            {[...draft.objectives].map((objectiveKey) => (
              <span key={objectiveKey} className={styles.miniChip}>
                {ClubObjectives.label(objectiveKey)}
              </span>
            ))}
          </div>
          {draft.memberCountRange ? (
            <p className={styles.panelBody}>
              {ClubMemberCountRanges.recapLabel(draft.memberCountRange)}
            </p>
          ) : null}
        </SetupCard>
      </div>
    </div>
  );
}
