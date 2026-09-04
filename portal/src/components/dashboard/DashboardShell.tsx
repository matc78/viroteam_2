"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BureauRouteGuard } from "@/components/auth/BureauRouteGuard";
import { SpaceSwitcher } from "@/components/auth/SpaceSwitcher";
import { ClubMembershipPicker } from "@/components/dashboard/ClubMembershipPicker";
import { DashboardModulePanels } from "@/components/dashboard/DashboardModulePanels";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import {
  bureauCapabilities,
  isBureauRouteAllowed,
} from "@/lib/auth/bureauPermissions";
import { usePlayerFeeDeadlineUrgency } from "@/lib/dashboard/useFeeDeadlineUrgency";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { site } from "@/lib/site";
import { clubsWithRole, membershipRoleForClub } from "@/lib/firebase/types";
import styles from "./DashboardShell.module.css";

const NAV_ITEMS = [
  { href: "/home", label: "Accueil", toneClass: "toneOrange" },
  { href: "/members", label: "Membres", toneClass: "toneGreen" },
  { href: "/team", label: "Équipe", toneClass: "toneGreen" },
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
  const router = useRouter();
  const {
    activeClub,
    bureauClubs,
    activeClubRole,
    profile,
    setActiveClubId,
  } = useAuth();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const feeDeadlineUrgent = usePlayerFeeDeadlineUrgency();

  const clubsWithRoles = useMemo(
    () => clubsWithRole(bureauClubs, profile),
    [bureauClubs, profile],
  );

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

  function handleClubChange(clubId: string) {
    const club = bureauClubs.find((item) => item.id === clubId);
    const nextRole = membershipRoleForClub(profile, clubId);
    const nextCaps = bureauCapabilities(nextRole, club?.coachPermissions);
    setActiveClubId(clubId);
    if (!isBureauRouteAllowed(pathname, nextCaps)) {
      router.replace("/home");
    }
  }

  const resolvedUserName = profile?.displayName ?? "Membre";
  const wide = isWidePath(pathname);
  const fillViewport =
    pathname === "/planning" || pathname.startsWith("/planning/");

  return (
    <div
      className={[
        fillViewport ? `${styles.page} ${styles.pageFill}` : styles.page,
        feeDeadlineUrgent ? styles.pageFeeDeadline : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
          </div>

          <ClubMembershipPicker
            clubs={clubsWithRoles}
            activeClubId={activeClub?.id ?? null}
            compact
            onClubChange={handleClubChange}
          />

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

        <nav className={styles.navStrip} aria-label="Modules espace club">
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
