"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { site } from "@/lib/site";
import styles from "./DashboardShell.module.css";

/** Props de la coquille espace club. */
type DashboardShellProps = {
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/home", label: "Accueil" },
  { href: "/fees", label: "Cotisations" },
] as const;

function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function userInitials(displayName: string): string {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return "A";
  if (nameParts.length === 1) return nameParts[0]!.slice(0, 1).toUpperCase();
  return `${nameParts[0]!.slice(0, 1)}${nameParts[1]!.slice(0, 1)}`.toUpperCase();
}

/** Coquille espace club : header bureau + nav modules + logout. */
export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const {
    activeClub,
    adminClubs,
    profile,
    setActiveClubId,
    logout,
  } = useAuth();

  const resolvedClubName = activeClub?.name ?? "Club";
  const resolvedAdminName = profile?.displayName ?? "Admin";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <div className={styles.brandBlock}>
            <Link
              href="/home"
              className={styles.brand}
              aria-label={`${site.name} — espace club`}
            >
              <Image
                src="/logo-mark.svg"
                alt=""
                width={32}
                height={32}
                className={styles.mark}
                priority
              />
              <span className={styles.wordmark}>{site.name}</span>
            </Link>
            <span className={styles.clubDivider} aria-hidden="true" />
            {adminClubs.length > 1 ? (
              <label className={styles.clubSelectLabel}>
                <span className={styles.srOnly}>Club actif</span>
                <select
                  className={styles.clubSelect}
                  value={activeClub?.id ?? ""}
                  onChange={(event) => setActiveClubId(event.target.value)}
                  aria-label="Sélectionner le club"
                >
                  {adminClubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className={styles.clubName}>{resolvedClubName}</span>
            )}
          </div>

          <nav className={styles.nav} aria-label="Modules espace club">
            {NAV_ITEMS.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink}${isActive ? ` ${styles.navLinkActive}` : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className={styles.actions}>
            <div className={styles.userBlock}>
              <span className={styles.avatar} aria-hidden="true">
                {userInitials(resolvedAdminName)}
              </span>
              <div className={styles.userMeta}>
                <span className={styles.userName}>{resolvedAdminName}</span>
                <span className={styles.roleChip}>Admin</span>
              </div>
            </div>
            <button
              type="button"
              className={styles.logoutButton}
              onClick={() => void logout()}
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
