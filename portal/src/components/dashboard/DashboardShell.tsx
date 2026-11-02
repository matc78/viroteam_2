"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { BureauRouteGuard } from "@/components/auth/BureauRouteGuard";
import { usePageLoad } from "@/components/common/PageLoadProvider";
import { DashboardModulePanels } from "@/components/dashboard/DashboardModulePanels";
import { PortalShell, type PortalNavItem } from "@/components/shell/PortalShell";
import {
  bureauCapabilities,
  bureauRoleChipLabel,
  isBureauRouteAllowed,
} from "@/lib/auth/bureauPermissions";
import { usePlayerFeeDeadlineUrgency } from "@/lib/dashboard/useFeeDeadlineUrgency";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  buildClubMembershipTiles,
  membershipRoleForClub,
  type PortalSpace,
} from "@/lib/firebase/types";

const NAV_ITEMS: readonly PortalNavItem[] = [
  { href: "/home", label: "Accueil", icon: "home", tone: "blue" },
  { href: "/members", label: "Membres", icon: "users", tone: "violet" },
  { href: "/team", label: "Équipe", icon: "team", tone: "green" },
  { href: "/planning", label: "Planning", icon: "calendar", tone: "cyan" },
  { href: "/fees", label: "Cotisations", icon: "wallet", tone: "orange" },
  { href: "/announcements", label: "Annonces", icon: "megaphone", tone: "pink" },
  { href: "/equipment", label: "Équipements", icon: "box", tone: "amber" },
  { href: "/settings", label: "Paramètres du club", icon: "settings", tone: "slate" },
];

const WIDE_PATH_PREFIXES = [
  "/members",
  "/planning",
  "/my-planning",
  "/messages",
] as const;

function isPathUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Pages hors club actif : pas de nav modules ni de club sélectionné. */
function isCrossClubPath(pathname: string): boolean {
  return ["/my-planning", "/messages", "/account"].some((href) =>
    isPathUnder(pathname, href),
  );
}

/** Coquille espace club : sidebar bureau + modules. */
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
  const { beginPageLoad } = usePageLoad();
  const feeDeadlineUrgent = usePlayerFeeDeadlineUrgency();

  const clubsWithRoles = useMemo(
    () => buildClubMembershipTiles(bureauClubs, familyClubs, profile),
    [bureauClubs, familyClubs, profile],
  );

  const caps = useMemo(
    () => bureauCapabilities(activeClubRole, activeClub?.coachPermissions),
    [activeClubRole, activeClub?.coachPermissions],
  );
  const visibleNavItems = useMemo(() => {
    const allowed = new Set(caps.navHrefs);
    return NAV_ITEMS.filter((item) => allowed.has(item.href)).map((item) =>
      // Joueur : une seule cotisation, la sienne.
      item.href === "/fees" && caps.isPlayer
        ? { ...item, label: "Ma cotisation" }
        : item,
    );
  }, [caps.navHrefs, caps.isPlayer]);

  function handleClubChange(clubId: string, space: PortalSpace) {
    if (space !== activeSpace) {
      const target = space === "family" ? "/family" : "/home";
      if (!selectClubContext(clubId, space)) return;
      beginPageLoad(target, { clubId, space });
      router.replace(target);
      return;
    }

    const club = bureauClubs.find((item) => item.id === clubId);
    const nextRole = membershipRoleForClub(profile, clubId);
    const nextCaps = bureauCapabilities(nextRole, club?.coachPermissions);
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
    isPathUnder(pathname, "/messages");

  return (
    <PortalShell
      spaceLabel="espace club"
      homeHref="/home"
      navItems={visibleNavItems}
      isNavItemActive={isPathUnder}
      crossClub={isCrossClubPath(pathname)}
      myPlanningHref="/my-planning"
      accountHref="/account"
      feesHref="/fees"
      feeDeadlineUrgent={feeDeadlineUrgent}
      fillViewport={fillViewport}
      wide={WIDE_PATH_PREFIXES.some((prefix) => isPathUnder(pathname, prefix))}
      clubs={clubsWithRoles}
      activeClubId={activeClub?.id ?? null}
      activeSpace={activeSpace}
      onClubChange={handleClubChange}
      accountSubtitle={bureauRoleChipLabel(activeClubRole)}
      routeGuard={<BureauRouteGuard />}
    >
      <DashboardModulePanels />
    </PortalShell>
  );
}
