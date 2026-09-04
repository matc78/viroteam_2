"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { SpaceSwitcher } from "@/components/auth/SpaceSwitcher";
import { FamilyRouteGuard } from "@/components/auth/FamilyRouteGuard";
import { ClubMembershipPicker } from "@/components/dashboard/ClubMembershipPicker";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import {
  FamilyAudienceProvider,
  useFamilyAudience,
} from "@/components/family/FamilyAudienceProvider";
import { FamilyModulePanels } from "@/components/family/FamilyModulePanels";
import { isFamilyRouteAllowed } from "@/lib/auth/bureauPermissions";
import { useFamilyFeeDeadlineUrgency } from "@/lib/dashboard/useFeeDeadlineUrgency";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { MemberRoles } from "@/lib/firebase/constants";
import { site } from "@/lib/site";
import { clubsWithRole } from "@/lib/firebase/types";
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
    familyClubs,
    profile,
    setActiveClubId,
  } = useAuth();
  const { selectedTarget } = useFamilyAudience();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const feeDeadlineUrgent = useFamilyFeeDeadlineUrgency(
    selectedTarget?.memberId ?? null,
  );

  const clubsWithRoles = useMemo(
    () =>
      clubsWithRole(familyClubs, profile, () => "family"),
    [familyClubs, profile],
  );

  const childHeaderLabel =
    selectedTarget?.kind === "child"
      ? selectedTarget.displayName
      : selectedTarget?.label ?? "Famille";

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  function handleClubChange(clubId: string) {
    setActiveClubId(clubId);
    if (!isFamilyRouteAllowed(pathname)) {
      router.replace("/family");
    }
  }

  const resolvedName = profile?.displayName ?? "Famille";
  const isPlanning = pathname.startsWith("/family/planning");
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
                if (pathname !== "/family") setPendingHref("/family");
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
            formatRoleLabel={() => childHeaderLabel}
            onClubChange={handleClubChange}
          />

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
                <RoleBadge
                  role={MemberRoles.player}
                  label="Famille"
                  className={styles.roleChip}
                />
              </div>
            </Link>
          </div>
        </div>

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
