"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { shouldShowPersonalPlanningTile } from "@/lib/firebase/personalPlanningService";
import styles from "./PersonalPlanningTile.module.css";

/** Props de la pastille « Mon planning » du header. */
type PersonalPlanningTileProps = {
  /** Route cible (`/my-planning` ou `/family/my-planning`). */
  href: string;
};

/** Icône calendrier (alignée sur la pastille club). */
function CalendarIcon() {
  return (
    <svg
      className={styles.iconSvg}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M3 10h18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Pastille header à côté du sélecteur de club : ouvre le planning
 * personnel multi-clubs (moi + équipes coachées + enfants liés).
 * Masquée s’il n’y a qu’un seul profil à suivre
 * (1 club sans enfant, ou parent d’un seul enfant).
 */
export function PersonalPlanningTile({ href }: PersonalPlanningTileProps) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  if (!shouldShowPersonalPlanningTile(profile)) {
    return null;
  }

  return (
    <Link
      href={href}
      scroll={false}
      prefetch
      className={`${styles.tile}${isActive ? ` ${styles.tileActive}` : ""}`}
      aria-label="Mon planning"
      aria-current={isActive ? "page" : undefined}
    >
      <span className={styles.icon} aria-hidden>
        <CalendarIcon />
      </span>
      <span className={styles.label}>Mon planning</span>
    </Link>
  );
}
