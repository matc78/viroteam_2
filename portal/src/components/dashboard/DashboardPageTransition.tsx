"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import styles from "./DashboardPageTransition.module.css";

type DashboardPageTransitionProps = {
  children: ReactNode;
};

/**
 * Micro-entrée du contenu à chaque changement de route dashboard.
 * Le shell (header/nav) reste hors de cette animation.
 */
export function DashboardPageTransition({
  children,
}: DashboardPageTransitionProps) {
  const pathname = usePathname();

  return (
    <div key={pathname} className={styles.root}>
      {children}
    </div>
  );
}
