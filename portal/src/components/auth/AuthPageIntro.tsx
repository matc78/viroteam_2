import styles from "./AuthShell.module.css";

/** Props de l'en-tete textuel du panneau auth. */
type AuthPageIntroProps = {
  eyebrow: string;
  title: string;
  lead: string;
};

/** En-tête textuel du panneau auth (eyebrow, titre, chapô). */
export function AuthPageIntro({ eyebrow, title, lead }: AuthPageIntroProps) {
  return (
    <>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>{lead}</p>
    </>
  );
}
