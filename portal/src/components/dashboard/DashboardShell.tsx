"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BureauRouteGuard } from "@/components/auth/BureauRouteGuard";
import { SpaceSwitcher } from "@/components/auth/SpaceSwitcher";
import { DashboardModulePanels } from "@/components/dashboard/DashboardModulePanels";
import { PlanningSelect } from "@/components/dashboard/PlanningSelect";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { bureauCapabilities } from "@/lib/auth/bureauPermissions";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { site } from "@/lib/site";
import { clubLabelWithSportEmoji } from "@/lib/sports/sportEmoji";
import styles from "./DashboardShell.module.css";

const NAV_ITEMS = [
  { href: "/home", label: "Accueil", toneClass: "toneOrange" },
  { href: "/members", label: "Membres", toneClass: "toneGreen" },
  { href: "/planning", label: "Planning", toneClass: "toneBlue" },
  { href: "/fees", label: "Cotisations", toneClass: "toneYellow" },
  { href: "/announcements", label: "Annonces", toneClass: "toneOrange" },
  { href: "/equipment", label: "Équipements", toneClass: "toneGreen" },
  { href: "/settings", label: "Paramètres", toneClass: "toneBlue" },
] as const;

const WIDE_PATH_PREFIXES = ["/members", "/planning", "/equipment"] as const;

function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isWidePath(pathname: string): boolean {
  return WIDE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function userInitials(displayName: string): string {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return "A";
  if (nameParts.length === 1) return nameParts[0]!.slice(0, 1).toUpperCase();
  return `${nameParts[0]!.slice(0, 1)}${nameParts[1]!.slice(0, 1)}`.toUpperCase();
}

/** Coquille espace club : header bureau + nav modules. */
export function DashboardShell() {
  const pathname = usePathname();
  const {
    activeClub,
    bureauClubs,
    activeClubRole,
    profile,
    setActiveClubId,
  } = useAuth();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const caps = useMemo(
    () =>
      bureauCapabilities(activeClubRole, activeClub?.coachPermissions),
    [activeClubRole, activeClub?.coachPermissions],
  );
  const allowedHrefs = useMemo(() => new Set(caps.navHrefs), [caps.navHrefs]);
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => allowedHrefs.has(item.href)),
    [allowedHrefs],
  );

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const resolvedClubName = activeClub?.name?.trim() || "Club";
  const resolvedUserName = profile?.displayName ?? "Membre";
  const wide = isWidePath(pathname);
  const fillViewport =
    pathname === "/planning" || pathname.startsWith("/planning/");

  return (
    <div className={fillViewport ? `${styles.page} ${styles.pageFill}` : styles.page}>
      <BureauRouteGuard />
      <header className={styles.header}>
        <div className={styles.inner}>
          <div className={styles.brandBlock}>
            <Link
              href="/home"
              className={styles.brand}
              aria-label={`${site.name} — espace club`}
              onClick={() => {
                if (pathname !== "/home") setPendingHref("/home");
              }}
            >
              <BrandMark className={styles.mark} priority />
              <span className={styles.wordmark}>{site.name}</span>
            </Link>
            <span className={styles.clubDivider} aria-hidden="true" />
            {bureauClubs.length > 1 ? (
              <label className={styles.clubSelectLabel}>
                <span className={styles.srOnly}>Club actif</span>
                <PlanningSelect
                  id="dashboard-active-club"
                  value={activeClub?.id ?? ""}
                  aria-label="Sélectionner le club"
                  options={bureauClubs.map((club) => ({
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

          <nav className={styles.nav} aria-label="Modules espace club">
            {visibleNavItems.map((item) => {
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
              href="/settings"
              className={styles.userBlockLink}
              aria-label="Ouvrir les paramètres"
              onClick={() => {
                if (pathname !== "/settings") setPendingHref("/settings");
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
                  {userInitials(resolvedUserName)}
                </span>
              )}
              <div className={styles.userMeta}>
                <span className={styles.userName}>{resolvedUserName}</span>
                <RoleBadge role={activeClubRole} className={styles.roleChip} />
              </div>
            </Link>
          </div>
        </div>
      </header>
      <main
        className={[
          styles.main,
          wide ? styles.mainWide : "",
          fillViewport ? styles.mainFill : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <DashboardModulePanels />
      </main>
    </div>
  );
}
