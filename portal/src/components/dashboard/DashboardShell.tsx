"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BureauRouteGuard } from "@/components/auth/BureauRouteGuard";
import { usePageLoad } from "@/components/common/PageLoadProvider";
import { ClubMembershipPicker } from "@/components/dashboard/ClubMembershipPicker";
import { DashboardModulePanels } from "@/components/dashboard/DashboardModulePanels";
import { PersonalPlanningTile } from "@/components/dashboard/PersonalPlanningTile";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import {
  bureauCapabilities,
  isBureauRouteAllowed,
} from "@/lib/auth/bureauPermissions";
import { usePlayerFeeDeadlineUrgency } from "@/lib/dashboard/useFeeDeadlineUrgency";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { MemberRoles } from "@/lib/firebase/constants";
import { site } from "@/lib/site";
import {
  buildClubMembershipTiles,
  membershipRoleForClub,
  type PortalSpace,
} from "@/lib/firebase/types";
import styles from "./DashboardShell.module.css";

/** Classe CSS avatar selon le rôle bureau actif. */
function avatarToneClass(role: string | null): string {
  if (role === MemberRoles.admin) return styles.avatarToneAdmin;
  if (role === MemberRoles.coach) return styles.avatarToneCoach;
  if (role === MemberRoles.player) return styles.avatarTonePlayer;
  return "";
}

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

const WIDE_PATH_PREFIXES = [
  "/home",
  "/members",
  "/planning",
  "/my-planning",
  "/equipment",
] as const;

function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isWidePath(pathname: string): boolean {
  return WIDE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isMyPlanningPath(pathname: string): boolean {
  return (
    pathname === "/my-planning" || pathname.startsWith("/my-planning/")
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
    activeSpace,
    bureauClubs,
    familyClubs,
    activeClubRole,
    profile,
    selectClubContext,
  } = useAuth();
  const { pendingHref, beginPageLoad } = usePageLoad();
  const feeDeadlineUrgent = usePlayerFeeDeadlineUrgency();

  const clubsWithRoles = useMemo(
    () => buildClubMembershipTiles(bureauClubs, familyClubs, profile),
    [bureauClubs, familyClubs, profile],
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

  function handleClubChange(clubId: string, space: PortalSpace) {
    if (space !== activeSpace) {
      const target = space === "family" ? "/family" : "/home";
      beginPageLoad(target, { clubId, space });
      selectClubContext(clubId, space);
      router.replace(target);
      return;
    }

    const club = bureauClubs.find((item) => item.id === clubId);
    const nextRole = membershipRoleForClub(profile, clubId);
    const nextCaps = bureauCapabilities(nextRole, club?.coachPermissions);
    const stayOnPage =
      !isMyPlanningPath(pathname) &&
      isBureauRouteAllowed(pathname, nextCaps);
    const target = stayOnPage ? pathname : "/home";
    beginPageLoad(target, { clubId, space });
    selectClubContext(clubId, space);
    if (!stayOnPage) {
      router.replace("/home");
    }
  }

  const resolvedUserName = profile?.displayName ?? "Membre";
  const wide = isWidePath(pathname);
  const onMyPlanning = isMyPlanningPath(pathname);
  const fillViewport =
    pathname === "/planning" ||
    pathname.startsWith("/planning/") ||
    onMyPlanning;

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
                if (pathname !== "/home") beginPageLoad("/home");
              }}
            >
              <BrandMark className={styles.mark} priority />
              <span className={styles.wordmark}>{site.name}</span>
            </Link>
          </div>

          <div className={styles.headerCenter}>
            <ClubMembershipPicker
              clubs={clubsWithRoles}
              activeClubId={onMyPlanning ? null : (activeClub?.id ?? null)}
              activeSpace={activeSpace}
              compact
              showCreateClub
              onClubChange={handleClubChange}
            />
          </div>

          <div className={styles.actions}>
            <PersonalPlanningTile href="/my-planning" />
            <Link
              href="/settings"
              className={styles.userBlockLink}
              aria-label="Ouvrir les paramètres"
              onClick={() => {
                if (pathname !== "/settings") beginPageLoad("/settings");
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
                <span
                  className={[styles.avatar, avatarToneClass(activeClubRole)]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                >
                  {userInitials(resolvedUserName)}
                </span>
              )}
              <div className={styles.userMeta}>
                <span className={styles.userName}>{resolvedUserName}</span>
                {!onMyPlanning ? (
                  <RoleBadge role={activeClubRole} className={styles.roleChip} />
                ) : null}
              </div>
            </Link>
          </div>
        </div>

        {!onMyPlanning ? (
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
                    if (!isActive) beginPageLoad(item.href);
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
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
