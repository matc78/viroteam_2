"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { SpaceSwitcher } from "@/components/auth/SpaceSwitcher";
import { DashboardPageTransition } from "@/components/dashboard/DashboardPageTransition";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { site } from "@/lib/site";
import styles from "@/components/dashboard/DashboardShell.module.css";

type FamilyShellProps = {
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/family", label: "Accueil" },
  { href: "/family/planning", label: "Planning" },
  { href: "/family/fees", label: "Cotisations" },
] as const;

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/family") return pathname === "/family";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function userInitials(displayName: string): string {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return "F";
  if (nameParts.length === 1) return nameParts[0]!.slice(0, 1).toUpperCase();
  return `${nameParts[0]!.slice(0, 1)}${nameParts[1]!.slice(0, 1)}`.toUpperCase();
}

/** Coquille espace famille : nav distincte du bureau admin. */
export function FamilyShell({ children }: FamilyShellProps) {
  const pathname = usePathname();
  const {
    activeClub,
    familyClubs,
    profile,
    setActiveClubId,
    logout,
  } = useAuth();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const resolvedClubName = activeClub?.name ?? "Club";
  const resolvedName = profile?.displayName ?? "Famille";
  const wide = pathname.startsWith("/family/planning");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <div className={styles.brandBlock}>
            <Link
              href="/family"
              className={styles.brand}
              aria-label={`${site.name} — espace famille`}
              onClick={() => {
                if (pathname !== "/family") setPendingHref("/family");
              }}
            >
              <BrandMark className={styles.mark} priority />
              <span className={styles.wordmark}>{site.name}</span>
            </Link>
            <span className={styles.clubDivider} aria-hidden="true" />
            {familyClubs.length > 1 ? (
              <label className={styles.clubSelectLabel}>
                <span className={styles.srOnly}>Club actif</span>
                <select
                  className={styles.clubSelect}
                  value={activeClub?.id ?? ""}
                  onChange={(event) => setActiveClubId(event.target.value)}
                  aria-label="Sélectionner le club"
                >
                  {familyClubs.map((club) => (
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

          <nav className={styles.nav} aria-label="Espace famille">
            {NAV_ITEMS.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              const isPending = pendingHref === item.href && !isActive;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink}${isActive ? ` ${styles.navLinkActive}` : ""}${isPending ? ` ${styles.navLinkPending}` : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => {
                    if (!isActive) setPendingHref(item.href);
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className={styles.actions}>
            <SpaceSwitcher />
            <div className={styles.userBlock}>
              <span className={styles.avatar} aria-hidden="true">
                {userInitials(resolvedName)}
              </span>
              <div className={styles.userMeta}>
                <span className={styles.userName}>{resolvedName}</span>
                <span className={styles.roleChip}>Famille</span>
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
      <main className={wide ? `${styles.main} ${styles.mainWide}` : styles.main}>
        <DashboardPageTransition>{children}</DashboardPageTransition>
      </main>
    </div>
  );
}
