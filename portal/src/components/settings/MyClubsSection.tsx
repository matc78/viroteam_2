"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { usePageLoad } from "@/components/common/PageLoadProvider";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { can } from "@/lib/auth/permissions";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { buildClubMembershipTiles } from "@/lib/firebase/types";
import panelStyles from "@/components/dashboard/DashboardPanel.module.css";
import shared from "@/components/settings/settingsShared.module.css";

/**
 * Liste des clubs du compte (bureau + famille) avec le badge du compte ; le
 * droit « Paramètres du club » ouvre les réglages de ce club.
 */
export function MyClubsSection() {
  const router = useRouter();
  const { bureauClubs, familyClubs, accessByClub, selectClubContext } =
    useAuth();
  const { beginPageLoad } = usePageLoad();

  const clubs = useMemo(
    () => buildClubMembershipTiles(bureauClubs, familyClubs, accessByClub),
    [bureauClubs, familyClubs, accessByClub],
  );

  function openClubSettings(clubId: string) {
    if (!selectClubContext(clubId, "bureau")) return;
    beginPageLoad("/settings", { clubId, space: "bureau" });
    router.push("/settings");
  }

  if (clubs.length === 0) return null;

  return (
    <section className={`${panelStyles.panel} ${shared.group}`} data-tone="cyan">
      <header className={shared.groupHeader}>
        <h2 className={shared.groupTitle}>Mes clubs</h2>
        <p className={shared.groupLead}>
          Les réglages propres à chaque club (saison, logo, capacités des
          coachs) sont gérés par les membres qui en ont le droit.
        </p>
      </header>
      <ul className={shared.permissionList}>
        {clubs.map((club) => {
          const clubAccess = accessByClub[club.id];
          const canOpenSettings =
            club.space === "bureau" &&
            clubAccess != null &&
            can(clubAccess, "manageClubSettings");
          const badge = club.space === "family" ? "parent" : club.badge;
          const initial = club.name.trim().slice(0, 1).toUpperCase() || "C";
          return (
            <li key={`${club.space}-${club.id}`} className={shared.clubRow}>
              {club.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={club.logoUrl} alt="" className={shared.clubRowLogo} />
              ) : (
                <span className={shared.clubRowLogo} aria-hidden="true">
                  {initial}
                </span>
              )}
              <div className={shared.clubRowIdentity}>
                <p className={shared.permissionLabel}>{club.name}</p>
                {badge ? <RoleBadge role={badge} size="sm" /> : null}
              </div>
              {canOpenSettings ? (
                <button
                  type="button"
                  className={shared.secondaryButton}
                  onClick={() => openClubSettings(club.id)}
                >
                  Paramètres du club
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
