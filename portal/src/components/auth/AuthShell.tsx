"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { AuthPageIntro } from "@/components/auth/AuthPageIntro";
import styles from "./AuthShell.module.css";

const easeOut = [0.22, 1, 0.36, 1] as [number, number, number, number];
const SLIDE_OFFSET = 14;

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

type AuthShellProps = AuthShellStaticProps | AuthShellAnimatedProps;

function isAnimatedProps(props: AuthShellProps): props is AuthShellAnimatedProps {
  return props.variant === "animated";
}

/**
 * Coquille auth : header, panneau centré, footer optionnel.
 * - `static` : intro intégrée (join, access-denied).
 * - `animated` : transition login ↔ signup (layout partagé, sans footer).
 */
export function AuthShell(props: AuthShellProps) {
  if (isAnimatedProps(props)) {
    return <AuthShellAnimated>{props.children}</AuthShellAnimated>;
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

/** Panneau animé pour login / inscription. */
function AuthShellAnimated({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [hasMounted, setHasMounted] = useState(false);
  const previousPathnameRef = useRef(pathname);
  const directionRef = useRef(0);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const isSignup = pathname.startsWith("/signup");
  const panelClass = isSignup
    ? `${styles.panel} ${styles.panelOrange} ${styles.panelWide}`
    : `${styles.panel} ${styles.panelCyan}`;

  if (previousPathnameRef.current !== pathname) {
    if (pathname.startsWith("/signup") && previousPathnameRef.current.startsWith("/login")) {
      directionRef.current = 1;
    } else if (
      pathname.startsWith("/login") &&
      previousPathnameRef.current.startsWith("/signup")
    ) {
      directionRef.current = -1;
    } else {
      directionRef.current = 0;
    }
  }

  useEffect(() => {
    previousPathnameRef.current = pathname;
  }, [pathname]);

  const direction = directionRef.current;
  const reduceMotion = hasMounted && Boolean(prefersReducedMotion);
  const slideX = reduceMotion ? 0 : direction * SLIDE_OFFSET;
  const shouldAnimateEntry = hasMounted && !reduceMotion;

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={panelClass}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              className={styles.panelContent}
              initial={shouldAnimateEntry ? { opacity: 0, x: slideX } : false}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -slideX }}
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
