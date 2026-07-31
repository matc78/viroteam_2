import { site } from "@/lib/site";
import styles from "./StoreBadges.module.css";

type StoreBadgesProps = {
  className?: string;
};

/** Badges Play Store (actif) et App Store (bientôt). */
export function StoreBadges({ className }: StoreBadgesProps) {
  return (
    <div className={[styles.badges, className].filter(Boolean).join(" ")}>
      <a
        className={styles.badge}
        href={site.playStoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Télécharger ViroTeam sur Google Play"
      >
        <PlayIcon />
        <span className={styles.copy}>
          <span className={styles.eyebrow}>Disponible sur</span>
          <span className={styles.label}>Google Play</span>
        </span>
      </a>

      <span
        className={styles.badgeDisabled}
        role="status"
        aria-label="App Store — bientôt disponible"
      >
        <AppleIcon />
        <span className={styles.copy}>
          <span className={styles.eyebrow}>Bientôt sur</span>
          <span className={styles.label}>
            App Store <span className={styles.soon}>· bientôt</span>
          </span>
        </span>
      </span>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      className={styles.icon}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M3.6 2.3c-.3.2-.5.5-.5.9v17.6c0 .4.2.7.5.9l.1.1 9.7-9.7v-.2L3.7 2.2l-.1.1Zm11.1 6.4L12 11.4l2.7 2.7 3.4-1.9c.9-.5.9-1.3 0-1.8l-3.4-1.7ZM4.7 3.7l8.3 4.7L10.3 11 4.7 3.7Zm0 16.6 5.6-7.3 2.7 2.7-8.3 4.6Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      className={styles.icon}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M16.4 12.7c0-2 1.6-3 1.7-3.1-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1-.1 1.5-.7 2.8-.7 1.3 0 1.7.7 2.8.7 1.2 0 1.9-1 2.6-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.2-.9-2.2-3.9ZM14.5 6.4c.6-.7 1-1.7.9-2.7-1 .1-2.1.6-2.8 1.4-.6.7-1.1 1.7-.9 2.7 1 .1 2.1-.5 2.8-1.4Z"
      />
    </svg>
  );
}
