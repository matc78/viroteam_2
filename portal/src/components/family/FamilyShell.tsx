"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { SpaceSwitcher } from "@/components/auth/SpaceSwitcher";
import { PlanningSelect } from "@/components/dashboard/PlanningSelect";
import { FamilyAudienceProvider } from "@/components/family/FamilyAudienceProvider";
import { FamilyModulePanels } from "@/components/family/FamilyModulePanels";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { site } from "@/lib/site";
import { clubLabelWithSportEmoji } from "@/lib/sports/sportEmoji";
import styles from "@/components/dashboard/DashboardShell.module.css";

const NAV_ITEMS = [
  { href: "/family", label: "Accueil", toneClass: "toneOrange" },
  { href: "/family/planning", label: "Planning", toneClass: "toneBlue" },
  { href: "/family/fees", label: "Cotisations", toneClass: "toneYellow" },
  { href: "/family/settings", label: "Paramètres", toneClass: "toneBlue" },
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
export function FamilyShell() {
  const pathname = usePathname();
  const {
    activeClub,
    familyClubs,
    profile,
    setActiveClubId,
  } = useAuth();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const resolvedClubName = activeClub?.name?.trim() || "Club";
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
                <PlanningSelect
                  id="family-active-club"
                  value={activeClub?.id ?? ""}
                  aria-label="Sélectionner le club"
                  options={familyClubs.map((club) => ({
                    value: club.id,
                    label: clubLabelWithSportEmoji({
                      name: club.name,
                      sport: club.sport,
                    }),
                  }))}
                  onChange={setActiveClubId}
                />
              </label>
            ) : (
              <span className={styles.clubName}>
                {clubLabelWithSportEmoji({
                  name: resolvedClubName,
                  sport: activeClub?.sport,
                })}
              </span>
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
                  scroll={false}
                  prefetch
                  className={`${styles.navLink} ${styles[item.toneClass]}${isActive ? ` ${styles.navLinkActive}` : ""}${isPending ? ` ${styles.navLinkPending}` : ""}`}
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
            <Link
              href="/family/settings"
              className={styles.userBlockLink}
              aria-label="Ouvrir les paramètres"
              onClick={() => {
                if (pathname !== "/family/settings") {
                  setPendingHref("/family/settings");
                }
              }}
            >
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className={styles.avatarImage}
                />
              ) : (
                <span className={styles.avatar} aria-hidden="true">
                  {userInitials(resolvedName)}
                </span>
              )}
              <div className={styles.userMeta}>
                <span className={styles.userName}>{resolvedName}</span>
                <span className={styles.roleChip}>Famille</span>
              </div>
            </Link>
          </div>
        </div>
      </header>
      <main className={wide ? `${styles.main} ${styles.mainWide}` : styles.main}>
        <FamilyAudienceProvider>
          <FamilyModulePanels />
        </FamilyAudienceProvider>
      </main>
    </div>
  );
}
