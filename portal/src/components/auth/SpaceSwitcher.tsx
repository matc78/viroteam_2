"use client";

import Link from "next/link";
import { useAuth } from "@/lib/firebase/AuthProvider";
import styles from "@/components/dashboard/DashboardShell.module.css";

/** Switcher Bureau / Famille — visible seulement si les deux espaces existent. */
export function SpaceSwitcher() {
  const { isBureauUser, isParent, activeSpace } = useAuth();
  if (!isBureauUser || !isParent) return null;

  return (
    <nav className={styles.spaceSwitch} aria-label="Espace">
      <Link
        href="/home"
        className={`${styles.spaceLink}${activeSpace === "bureau" ? ` ${styles.spaceLinkActive}` : ""}`}
        aria-current={activeSpace === "bureau" ? "page" : undefined}
      >
        Bureau
      </Link>
      <Link
        href="/family"
        className={`${styles.spaceLink}${activeSpace === "family" ? ` ${styles.spaceLinkActive}` : ""}`}
        aria-current={activeSpace === "family" ? "page" : undefined}
      >
        Famille
      </Link>
    </nav>
  );
}
