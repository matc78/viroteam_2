"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { AuthPageIntro } from "@/components/auth/AuthPageIntro";
import styles from "./AuthShell.module.css";

const easeOut = [0.22, 1, 0.36, 1] as [number, number, number, number];

type AuthShellBaseProps = {
  children: ReactNode;
};

type AuthShellStaticProps = AuthShellBaseProps & {
  variant?: "static";
  /** Accent de bordure du panneau. */
  accent?: "cyan" | "orange";
  eyebrow: string;
  title: string;
  lead: string;
};

type AuthShellAnimatedProps = AuthShellBaseProps & {
  variant: "animated";
};

type AuthShellStageProps = AuthShellBaseProps & {
  variant: "stage";
};

type AuthShellProps =
  | AuthShellStaticProps
  | AuthShellAnimatedProps
  | AuthShellStageProps;

/**
 * Coquille auth : header, panneau centré, footer optionnel.
 * - `static` : intro intégrée (join, access-denied).
 * - `animated` : panneau à fondu entre pages (mot de passe oublié).
 * - `stage` : sans panneau, le contenu dessine ses cartes (carrousel login).
 */
export function AuthShell(props: AuthShellProps) {
  if (props.variant === "animated") {
    return <AuthShellAnimated>{props.children}</AuthShellAnimated>;
  }

  if (props.variant === "stage") {
    return (
      <div className={styles.page}>
        <SiteHeader />
        <main className={`${styles.main} ${styles.mainStage}`}>
          {props.children}
        </main>
      </div>
    );
  }

  const accent = props.accent ?? "cyan";
  const panelClass =
    accent === "orange"
      ? `${styles.panel} ${styles.panelOrange}`
      : `${styles.panel} ${styles.panelCyan}`;

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={panelClass}>
          <AuthPageIntro
            eyebrow={props.eyebrow}
            title={props.title}
            lead={props.lead}
          />
          {props.children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Panneau à fondu d’entrée pour les pages du groupe `(auth)`. */
function AuthShellAnimated({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const reduceMotion = hasMounted && Boolean(prefersReducedMotion);
  const shouldAnimateEntry = hasMounted && !reduceMotion;

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={`${styles.panel} ${styles.panelCyan}`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              className={styles.panelContent}
              initial={shouldAnimateEntry ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26, ease: easeOut }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
