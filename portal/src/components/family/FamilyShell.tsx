"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useMemo } from "react";
import { FamilyRouteGuard } from "@/components/auth/FamilyRouteGuard";
import { usePageLoad } from "@/components/common/PageLoadProvider";
import {
  FamilyAudienceProvider,
  FamilyTargetFromUrlSync,
  useFamilyAudience,
} from "@/components/family/FamilyAudienceProvider";
import { FamilyModulePanels } from "@/components/family/FamilyModulePanels";
import { PortalShell, type PortalNavItem } from "@/components/shell/PortalShell";
import { isFamilyRouteAllowed } from "@/lib/auth/bureauPermissions";
import { useFamilyFeeDeadlineUrgency } from "@/lib/dashboard/useFeeDeadlineUrgency";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  buildClubMembershipTiles,
  type PortalSpace,
} from "@/lib/firebase/types";

const NAV_ITEMS: readonly PortalNavItem[] = [
  { href: "/family", label: "Accueil", icon: "home", tone: "blue" },
  { href: "/family/planning", label: "Planning", icon: "calendar", tone: "cyan" },
  { href: "/family/team", label: "Équipe", icon: "team", tone: "green" },
  { href: "/family/fees", label: "Cotisations", icon: "wallet", tone: "orange" },
];

function isPathUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/family") return pathname === "/family";
  return isPathUnder(pathname, href);
}

function isFamilyCrossClubPath(pathname: string): boolean {
  return ["/family/my-planning", "/family/messages", "/family/settings"].some(
    (href) => isPathUnder(pathname, href),
  );
}

/** Sidebar famille (audience résolue pour le nom de l’enfant). */
function FamilyShellChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    activeClub,
    activeSpace,
    bureauClubs,
    familyClubs,
    accessByClub,
    selectClubContext,
  } = useAuth();
  const { beginPageLoad } = usePageLoad();
  const { selectedTarget } = useFamilyAudience();
  const feeDeadlineUrgent = useFamilyFeeDeadlineUrgency(
    selectedTarget?.memberId ?? null,
  );

  const clubsWithRoles = useMemo(
    () => buildClubMembershipTiles(bureauClubs, familyClubs, accessByClub),
    [bureauClubs, familyClubs, accessByClub],
  );

  const childLabel =
    selectedTarget?.kind === "child"
      ? selectedTarget.displayName
      : (selectedTarget?.label ?? "Famille");

  function handleClubChange(clubId: string, space: PortalSpace) {
    if (space !== activeSpace) {
      const target = space === "family" ? "/family" : "/home";
      if (!selectClubContext(clubId, space)) return;
      beginPageLoad(target, { clubId, space });
      router.replace(target);
      return;
    }

    const stayOnPage =
      !isFamilyCrossClubPath(pathname) && isFamilyRouteAllowed(pathname);
    const target = stayOnPage ? pathname : "/family";
    if (!selectClubContext(clubId, space)) return;
    beginPageLoad(target, { clubId, space });
    if (!stayOnPage) {
      router.replace("/family");
    }
  }

  const fillViewport =
    isPathUnder(pathname, "/family/planning") ||
    isPathUnder(pathname, "/family/my-planning") ||
    isPathUnder(pathname, "/family/messages");

  return (
    <PortalShell
      spaceLabel="espace famille"
      homeHref="/family"
      navItems={NAV_ITEMS}
      isNavItemActive={isNavItemActive}
      crossClub={isFamilyCrossClubPath(pathname)}
      myPlanningHref="/family/my-planning"
      accountHref="/family/settings"
      feesHref="/family/fees"
      feeDeadlineUrgent={feeDeadlineUrgent}
      fillViewport={fillViewport}
      wide={fillViewport}
      clubs={clubsWithRoles}
      activeClubId={activeClub?.id ?? null}
      activeSpace={activeSpace}
      formatClubSecondaryLabel={(club) =>
        club.space === "family" && club.id === activeClub?.id
          ? `Parent · ${childLabel}`
          : null
      }
      onClubChange={handleClubChange}
      accountSubtitle={`Parent · ${childLabel}`}
      routeGuard={<FamilyRouteGuard />}
    >
      <FamilyModulePanels />
    </PortalShell>
  );
}

/** Coquille espace famille : nav distincte du bureau admin. */
export function FamilyShell() {
  return (
    <FamilyAudienceProvider>
      <Suspense fallback={null}>
        <FamilyTargetFromUrlSync />
      </Suspense>
      <FamilyShellChrome />
    </FamilyAudienceProvider>
  );
}
