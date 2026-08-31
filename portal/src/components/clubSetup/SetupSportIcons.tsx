import type { CSSProperties } from "react";
import styles from "./SetupSportIcons.module.css";

type ClubSetupSportIconProps = {
  src: string;
  alt: string;
  isReached: boolean;
  isCurrent?: boolean;
};

const maskLayerStyle = (src: string): CSSProperties => ({
  WebkitMaskImage: `url(${src})`,
  maskImage: `url(${src})`,
});

/** Picto sportif en rendu néon (tube + cœur blanc + bloom). */
export function ClubSetupSportIcon({
  src,
  alt,
  isReached,
  isCurrent = false,
}: ClubSetupSportIconProps) {
  if (!isReached) {
    return (
      <span className={styles.neonIcon} role="img" aria-label={alt}>
        <span className={styles.neonOff} style={maskLayerStyle(src)} aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={`${styles.neonIcon} ${isCurrent ? styles.neonIconCurrent : ""}`}
      role="img"
      aria-label={alt}
    >
      <span className={styles.neonBloom} style={maskLayerStyle(src)} aria-hidden />
      <span className={styles.neonTube} style={maskLayerStyle(src)} aria-hidden />
      <span className={styles.neonCore} style={maskLayerStyle(src)} aria-hidden />
    </span>
  );
}
