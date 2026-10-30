import Image from "next/image";
import styles from "./BrowserFrame.module.css";

export type BrowserFrameProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
};

/** Capture du portail web dans une fenêtre de navigateur stylisée. */
export function BrowserFrame({
  src,
  alt,
  width = 1024,
  height = 530,
  sizes = "(max-width: 899px) 100vw, 46rem",
  className,
}: BrowserFrameProps) {
  return (
    <div className={`${styles.frame} ${className ?? ""}`.trim()}>
      <div className={styles.bar} aria-hidden="true">
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.address}>viroteam.com</span>
      </div>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        className={styles.image}
      />
    </div>
  );
}
