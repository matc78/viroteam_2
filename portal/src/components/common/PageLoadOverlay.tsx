import { BrandMark } from "@/components/BrandMark";
import styles from "./PageLoadOverlay.module.css";

type PageLoadOverlayProps = {
  /** Message accessible (sr-only). */
  message?: string;
};

/** Voile blanc plein écran avec le logo ViroTeam rotatif au centre. */
export function PageLoadOverlay({
  message = "Chargement…",
}: PageLoadOverlayProps) {
  return (
    <div className={styles.veil} role="status" aria-live="polite">
      <BrandMark size={56} className={styles.logo} priority />
      <span className="sr-only">{message}</span>
    </div>
  );
}
