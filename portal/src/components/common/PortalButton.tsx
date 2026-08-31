import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./PortalButton.module.css";

type PortalButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  loading?: boolean;
};

/** CTA triple cadre (cyan → vert → orange), aligné sur ViroPortalButton Flutter. */
export function PortalButton({
  children,
  loading = false,
  disabled,
  className,
  type = "button",
  ...rest
}: PortalButtonProps) {
  const isDisabled = Boolean(disabled || loading);
  const classes = [styles.root, isDisabled ? styles.rootDisabled : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={styles.frame}>
        <span className={styles.frameInner}>
          <span className={styles.panel}>
            {loading ? <span className={styles.spinner} aria-hidden /> : children}
          </span>
        </span>
      </span>
    </button>
  );
}
