import Image from "next/image";
import styles from "./PhoneFrame.module.css";

export type PhoneFrameProps = {
  src: string;
  /** Texte alternatif ; chaîne vide si la capture est décorative. */
  alt: string;
  /** Dimensions intrinsèques de la capture (ratio conservé). */
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
};

/** Capture d'écran mobile présentée dans un cadre de téléphone dessiné en CSS. */
export function PhoneFrame({
  src,
  alt,
  width = 738,
  height = 1500,
  priority = false,
  sizes = "(max-width: 899px) 70vw, 20rem",
  className,
}: PhoneFrameProps) {
  return (
    <div className={`${styles.frame} ${className ?? ""}`.trim()}>
      <div className={styles.screen}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          className={styles.image}
        />
      </div>
    </div>
  );
}
