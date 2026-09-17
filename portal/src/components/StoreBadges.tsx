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
      height="24"
      viewBox="0 0 256 283"
      aria-hidden="true"
    >
      {/* Logo Google Play officiel — bleu / vert / jaune / rouge. */}
      <path
        fill="#4285F4"
        d="M1.06 23.49C.34 26.13 0 28.87 0 31.61v219.33c.01 2.74.36 5.47 1.06 8.12L123.61 138.1 1.06 23.49Z"
      />
      <path
        fill="#34A853"
        d="M120.44 141.27 181.71 80.79 48.56 4.5C43.55 1.57 37.86.02 32.05 0 17.64-.03 4.98 9.53 1.06 23.4l119.38 117.87Z"
      />
      <path
        fill="#FBBC04"
        d="M239.37 113.81 181.71 80.79l-64.9 56.95 65.16 64.28 57.22-32.67c10.33-5.41 16.81-16.11 16.81-27.77 0-11.66-6.47-22.36-16.81-27.77l.18 0Z"
      />
      <path
        fill="#EA4335"
        d="M119.55 134.92 1.06 259.06c2.7 9.56 9.66 17.33 18.86 21.06 9.2 3.73 19.61 3 28.2-1.99l133.33-75.93-61.9-67.28Z"
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
