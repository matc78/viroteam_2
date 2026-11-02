import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

/** Variante visuelle d’un bouton de l’espace connecté. */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** Props communes bouton / lien-bouton. */
type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
};

function buttonClassName({
  variant = "secondary",
  size = "md",
  className,
}: Omit<ButtonStyleProps, "children">): string {
  return [styles.button, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(" ");
}

/** Bouton d’action (primaire = une seule action principale par zone). */
export function Button({
  variant,
  size,
  className,
  children,
  type = "button",
  ...rest
}: ButtonStyleProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Lien de navigation présenté comme un bouton. */
export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  onClick,
}: ButtonStyleProps & { href: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      className={buttonClassName({ variant, size, className })}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

/** Lien texte discret (« Voir tout », « Planning »). */
export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={styles.textLink}>
      {children}
    </Link>
  );
}
