"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { BureauRouteGuard } from "@/components/auth/BureauRouteGuard";
import { usePageLoad } from "@/components/common/PageLoadProvider";
import { DashboardModulePanels } from "@/components/dashboard/DashboardModulePanels";
import { PortalShell, type PortalNavItem } from "@/components/shell/PortalShell";
import {
  bureauCapabilities,
  isBureauRouteAllowed,
} from "@/lib/auth/bureauPermissions";
import { NO_CLUB_ACCESS } from "@/lib/auth/permissions";
import { useBureauCapabilities } from "@/lib/auth/useBureauCapabilities";
import { isBureauMessagesPath } from "@/lib/chat/isMessagesPath";
import { badgeLabel } from "@/lib/copy/badgeCopy";
import { usePlayerFeeDeadlineUrgency } from "@/lib/dashboard/useFeeDeadlineUrgency";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { isVolleyballSport } from "@/lib/standings/standingsTypes";
import {
  accountClubBadge,
  buildClubMembershipTiles,
  type PortalSpace,
} from "@/lib/firebase/types";

const NAV_ITEMS: readonly PortalNavItem[] = [
  { href: "/home", label: "Accueil", icon: "home", tone: "blue" },
  { href: "/members", label: "Membres", icon: "users", tone: "violet" },
  { href: "/teams", label: "Équipes", icon: "team", tone: "green" },
  { href: "/team", label: "Équipe", icon: "team", tone: "green" },
  { href: "/planning", label: "Planning", icon: "calendar", tone: "cyan" },
  { href: "/attendance", label: "Présences", icon: "chart", tone: "teal" },
  { href: "/club-standings", label: "Classements", icon: "trophy", tone: "amber" },
  { href: "/fees", label: "Cotisations", icon: "wallet", tone: "orange" },
  { href: "/announcements", label: "Annonces", icon: "megaphone", tone: "pink" },
  { href: "/equipment", label: "Équipements", icon: "box", tone: "amber" },
  { href: "/settings", label: "Paramètres du club", icon: "settings", tone: "slate" },
];

const WIDE_PATH_PREFIXES = [
  "/members",
  "/teams",
  "/attendance",
  "/planning",
  "/my-planning",
  "/standings",
  "/club-standings",
  "/messages",
] as const;

function isPathUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Pages hors club actif : pas de nav modules ni de club sélectionné. */
function isCrossClubPath(pathname: string): boolean {
  return (
    isPathUnder(pathname, "/my-planning") ||
    isPathUnder(pathname, "/standings") ||
    isPathUnder(pathname, "/account") ||
    isBureauMessagesPath(pathname)
  );
}

/** Coquille espace club : sidebar bureau + modules, filtrés par les droits. */
export function DashboardShell() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    activeClub,
    activeSpace,
    bureauClubs,
    familyClubs,
    accessByClub,
    activeClubAccessLoading,
    selectClubContext,
  } = useAuth();
  const caps = useBureauCapabilities();
  const { beginPageLoad } = usePageLoad();
  const feeDeadlineUrgent = usePlayerFeeDeadlineUrgency();

  const clubsWithBadges = useMemo(
    () => buildClubMembershipTiles(bureauClubs, familyClubs, accessByClub),
    [bureauClubs, familyClubs, accessByClub],
  );

  // Badge principal du compte dans le club actif ; aucun tant que la fiche
  // charge (évite le flash « Membre »).
  const activeBadge =
    activeClubAccessLoading || !activeClub
      ? null
      : accountClubBadge(
          caps.access,
          familyClubs.some((club) => club.id === activeClub.id),
        );

  const visibleNavItems = useMemo(() => {
    const allowed = new Set(caps.navHrefs);
    // Classements du club : FFVB, donc clubs de volley seulement.
    if (!isVolleyballSport(activeClub?.sport)) {
      allowed.delete("/club-standings");
    }
    return NAV_ITEMS.filter((item) => allowed.has(item.href)).map((item) =>
      // Sans droit de lecture des cotisations : une seule cotisation, la sienne.
      item.href === "/fees" && !caps.canViewFees
        ? { ...item, label: "Ma cotisation" }
        : item,
    );
  }, [caps.navHrefs, caps.canViewFees, activeClub?.sport]);

  function handleClubChange(clubId: string, space: PortalSpace) {
    if (space !== activeSpace) {
      const target = space === "family" ? "/family" : "/home";
      if (!selectClubContext(clubId, space)) return;
      beginPageLoad(target, { clubId, space });
      router.replace(target);
      return;
    }

    const nextCaps = bureauCapabilities(accessByClub[clubId] ?? NO_CLUB_ACCESS);
    const stayOnPage =
      !isCrossClubPath(pathname) && isBureauRouteAllowed(pathname, nextCaps);
    const target = stayOnPage ? pathname : "/home";
    if (!selectClubContext(clubId, space)) return;
    beginPageLoad(target, { clubId, space });
    if (!stayOnPage) {
      router.replace("/home");
    }
  }

  const fillViewport =
    isPathUnder(pathname, "/planning") ||
    isPathUnder(pathname, "/my-planning") ||
    isBureauMessagesPath(pathname);

  return (
    <PortalShell
      spaceLabel="espace club"
      homeHref="/home"
      navItems={visibleNavItems}
      isNavItemActive={isPathUnder}
      crossClub={isCrossClubPath(pathname)}
      myPlanningHref="/my-planning"
      standingsHref={
        [...bureauClubs, ...familyClubs].some((club) =>
          isVolleyballSport(club.sport),
        )
          ? "/standings"
          : null
      }
      accountHref="/account"
      feesHref="/fees"
      feeDeadlineUrgent={feeDeadlineUrgent}
      fillViewport={fillViewport}
      wide={WIDE_PATH_PREFIXES.some((prefix) => isPathUnder(pathname, prefix))}
      clubs={clubsWithBadges}
      activeClubId={activeClub?.id ?? null}
      activeSpace={activeSpace}
      onClubChange={handleClubChange}
      accountSubtitle={activeBadge ? badgeLabel(activeBadge) : ""}
      routeGuard={<BureauRouteGuard />}
    >
      <DashboardModulePanels />
    </PortalShell>
  );
}
