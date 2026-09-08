"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { BrandMark } from "@/components/BrandMark";
import { FamilyRouteGuard } from "@/components/auth/FamilyRouteGuard";
import { usePageLoad } from "@/components/common/PageLoadProvider";
import { ClubMembershipPicker } from "@/components/dashboard/ClubMembershipPicker";
import { PersonalPlanningTile } from "@/components/dashboard/PersonalPlanningTile";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import {
  FamilyAudienceProvider,
  useFamilyAudience,
} from "@/components/family/FamilyAudienceProvider";
import { FamilyModulePanels } from "@/components/family/FamilyModulePanels";
import { isFamilyRouteAllowed } from "@/lib/auth/bureauPermissions";
import { useFamilyFeeDeadlineUrgency } from "@/lib/dashboard/useFeeDeadlineUrgency";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { PortalUiRoles } from "@/lib/firebase/constants";
import { site } from "@/lib/site";
import {
  buildClubMembershipTiles,
  type PortalSpace,
} from "@/lib/firebase/types";
import styles from "@/components/dashboard/DashboardShell.module.css";

const NAV_ITEMS = [
  { href: "/family", label: "Accueil", toneClass: "toneOrange" },
  { href: "/family/team", label: "Équipe", toneClass: "toneGreen" },
  { href: "/family/planning", label: "Planning", toneClass: "toneBlue" },
] as const;

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/family") return pathname === "/family";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isFamilyMyPlanningPath(pathname: string): boolean {
  return (
    pathname === "/family/my-planning" ||
    pathname.startsWith("/family/my-planning/")
  );
}

function userInitials(displayName: string): string {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return "F";
  if (nameParts.length === 1) return nameParts[0]!.slice(0, 1).toUpperCase();
  return `${nameParts[0]!.slice(0, 1)}${nameParts[1]!.slice(0, 1)}`.toUpperCase();
}

/** Header + nav famille (audience résolue pour le nom de l’enfant). */
function FamilyShellChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    activeClub,
    activeSpace,
    bureauClubs,
    familyClubs,
    profile,
    selectClubContext,
  } = useAuth();
  const { pendingHref, beginPageLoad } = usePageLoad();
  const { selectedTarget } = useFamilyAudience();
  const feeDeadlineUrgent = useFamilyFeeDeadlineUrgency(
    selectedTarget?.memberId ?? null,
  );

  const clubsWithRoles = useMemo(
    () => buildClubMembershipTiles(bureauClubs, familyClubs, profile),
    [bureauClubs, familyClubs, profile],
  );

  const childHeaderLabel =
    selectedTarget?.kind === "child"
      ? selectedTarget.displayName
      : selectedTarget?.label ?? "Famille";

  function handleClubChange(clubId: string, space: PortalSpace) {
    if (space !== activeSpace) {
      const target = space === "family" ? "/family" : "/home";
      beginPageLoad(target, { clubId, space });
      selectClubContext(clubId, space);
      router.replace(target);
      return;
    }

    const stayOnPage =
      !isFamilyMyPlanningPath(pathname) && isFamilyRouteAllowed(pathname);
    const target = stayOnPage ? pathname : "/family";
    beginPageLoad(target, { clubId, space });
    selectClubContext(clubId, space);
    if (!stayOnPage) {
      router.replace("/family");
    }
  }

  const resolvedName = profile?.displayName ?? "Famille";
  const onMyPlanning = isFamilyMyPlanningPath(pathname);
  const isPlanning =
    pathname.startsWith("/family/planning") || onMyPlanning;
  const fillViewport = isPlanning;

  return (
    <div
      className={[
        fillViewport ? `${styles.page} ${styles.pageFill}` : styles.page,
        feeDeadlineUrgent ? styles.pageFeeDeadline : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <FamilyRouteGuard />
      <header className={styles.header}>
        <div className={styles.inner}>
          <div className={styles.brandBlock}>
            <Link
              href="/family"
              className={styles.brand}
              aria-label={`${site.name} — espace famille`}
              onClick={() => {
                if (pathname !== "/family") beginPageLoad("/family");
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
              formatSecondaryLabel={(club) =>
                club.space === "family" ? childHeaderLabel : null
              }
              onClubChange={handleClubChange}
            />
          </div>

          <div className={styles.actions}>
            <PersonalPlanningTile href="/family/my-planning" />
            <Link
              href="/family/settings"
              className={styles.userBlockLink}
              aria-label="Ouvrir les paramètres"
              onClick={() => {
                if (pathname !== "/family/settings") {
                  beginPageLoad("/family/settings");
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
                <RoleBadge
                  role={PortalUiRoles.parent}
                  className={styles.roleChip}
                />
              </div>
            </Link>
          </div>
        </div>

        {!onMyPlanning ? (
          <nav className={styles.navStrip} aria-label="Espace famille">
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
          isPlanning ? styles.mainWide : "",
          fillViewport ? styles.mainFill : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <FamilyModulePanels />
      </main>
    </div>
  );
}

/** Coquille espace famille : nav distincte du bureau admin. */
export function FamilyShell() {
  return (
    <FamilyAudienceProvider>
      <FamilyShellChrome />
    </FamilyAudienceProvider>
  );
}
