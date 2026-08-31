import styles from "./AuthShell.module.css";

/** Props de l'en-tete textuel du panneau auth. */
type AuthPageIntroProps = {
  eyebrow: string;
  title: string;
  lead: string;
};

/** En-tête textuel du panneau auth (eyebrow, titre, chapô). */
export function AuthPageIntro({
  eyebrow,
  title,
  lead,
  compact = false,
  dense = false,
}: AuthPageIntroProps & { compact?: boolean; dense?: boolean }) {
  return (
    <>
      <span
        className={dense ? `${styles.eyebrow} ${styles.eyebrowDense}` : styles.eyebrow}
      >
        {eyebrow}
      </span>
      <h1
        className={[
          styles.title,
          dense ? styles.titleDense : "",
          !lead.trim() ? styles.titleNoLead : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {title}
      </h1>
      {lead.trim() ? (
        <p
          className={
            dense
              ? `${styles.lead} ${styles.leadDense}`
              : compact
                ? `${styles.lead} ${styles.leadCompact}`
                : styles.lead
          }
        >
          {lead}
        </p>
      ) : null}
    </>
  );
}
