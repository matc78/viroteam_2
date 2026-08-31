import type { ClubSetupDraft } from "@/lib/clubSetup/clubSetupDraft";
import {
  ClubMemberCountRanges,
  ClubObjectives,
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
  const headquartersLine = ClubSetupFormat.headquartersLine({
    address: draft.address,
    postalCode: draft.postalCode,
    city: draft.city,
  });

  return (
    <div className={styles.layout}>
        <SetupCard accent={sportAccent} className={styles.heroCard}>
          <div
            className={styles.logo}
            style={{ ["--sport-accent" as string]: sportAccent } as React.CSSProperties}
          >
            {draft.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.logoDataUrl} alt="" />
            ) : (
              <span aria-hidden>{sportEmoji(draft.sport)}</span>
            )}
          </div>
          <div>
            <h3 className={styles.heroTitle}>
              {draft.name.trim() || "Nom du club"}
            </h3>
            <p
              className={styles.heroMeta}
              style={{ color: sportAccent }}
            >
              {sportEmoji(draft.sport)} {draft.sport}
              {draft.city ? ` · ${draft.city}` : ""}
            </p>
          </div>
        </SetupCard>

        <SetupCard accent="var(--color-sport-cyan)">
          <h4 className={styles.panelTitle}>Localisation</h4>
          <p className={styles.panelBody}>{headquartersLine || draft.city}</p>
          {draft.practiceLocations.length > 0 ? (
            <p className={styles.panelBody}>
              {draft.practiceLocations
                .map((location) =>
                  location.address
                    ? `${location.name} (${location.address})`
                    : location.name,
                )
                .join("\n")}
            </p>
          ) : null}
        </SetupCard>

        <SetupCard accent="var(--color-sport-orange)">
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
  );
}
