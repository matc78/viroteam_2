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
  headingLevel = 1,
}: AuthPageIntroProps & {
  compact?: boolean;
  dense?: boolean;
  /** 2 quand plusieurs intros cohabitent sur la page (carrousel). */
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h1";
  return (
    <>
      <span
        className={dense ? `${styles.eyebrow} ${styles.eyebrowDense}` : styles.eyebrow}
      >
        {eyebrow}
      </span>
      <Heading
        className={[
          styles.title,
          dense ? styles.titleDense : "",
          !lead.trim() ? styles.titleNoLead : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {title}
      </Heading>
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
