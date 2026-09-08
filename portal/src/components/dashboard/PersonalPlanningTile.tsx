"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { requestPersonalPlanningReload } from "@/lib/dashboard/personalPlanningReload";
import { shouldShowPersonalPlanningTile } from "@/lib/firebase/personalPlanningService";
import styles from "./PersonalPlanningTile.module.css";

/** Props du bouton « Mon planning » du header. */
type PersonalPlanningTileProps = {
  /** Route cible (`/my-planning` ou `/family/my-planning`). */
  href: string;
};

/** Icône calendrier du bouton « Mon planning ». */
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
 * Bouton d’action du header (zone droite, avant le profil) : ouvre le
 * planning personnel multi-clubs (moi + équipes coachées + enfants liés).
 * Masqué s’il n’y a qu’un seul profil à suivre
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
      aria-label={isActive ? "Mon planning (recliquer pour actualiser)" : "Mon planning"}
      aria-current={isActive ? "page" : undefined}
      onClick={(event) => {
        if (!isActive) return;
        event.preventDefault();
        requestPersonalPlanningReload("tile-reclick");
      }}
    >
      <span className={styles.icon} aria-hidden>
        <CalendarIcon />
      </span>
      <span className={styles.label}>Mon planning</span>
    </Link>
  );
}
