import type { ReactNode } from "react";
import styles from "./SetupStepFrame.module.css";

type SetupStepFrameProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  centerBody?: boolean;
};

/** Conteneur d’étape wizard (équivalent SetupStepShell Flutter). */
export function SetupStepFrame({
  title,
  subtitle,
  children,
  footer,
  centerBody = false,
}: SetupStepFrameProps) {
  return (
    <div className={styles.frame}>
      {(title || subtitle) && (
        <header className={styles.header}>
          {title ? <h2 className={styles.title}>{title}</h2> : null}
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </header>
      )}
      <div
        className={`${styles.body} ${centerBody ? styles.bodyCentered : ""}`}
      >
        <div className={styles.bodyInner}>{children}</div>
      </div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </div>
  );
}
