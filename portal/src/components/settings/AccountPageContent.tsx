"use client";

import { useMemo } from "react";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { AccountExitSection } from "@/components/settings/AccountExitSection";
import { AccountSettingsSection } from "@/components/settings/AccountSettingsSection";
import { MyClubsSection } from "@/components/settings/MyClubsSection";
import { NotificationPreferencesSection } from "@/components/settings/NotificationPreferencesSection";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { MemberRoles } from "@/lib/firebase/constants";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import shared from "@/components/settings/settingsShared.module.css";

/**
 * Paramètres globaux du compte (bureau `/account` + famille `/family/settings`) :
 * compte, notifications, puis la liste des clubs ; sortie en bas de page.
 */
export function AccountPageContent({ eyebrow }: { eyebrow: string }) {
  const { profile } = useAuth();

  // Bilan des réponses : utile seulement aux coachs / admins d’au moins un club.
  const isStaffSomewhere = useMemo(
    () =>
      (profile?.clubMemberships ?? []).some(
        (membership) =>
          membership.role === MemberRoles.admin ||
          membership.role === MemberRoles.coach,
      ),
    [profile?.clubMemberships],
  );

  return (
    <div className={`${transitionStyles.page} ${shared.stack} ${shared.stackWide}`}>
      <DashboardPageIntro
        eyebrow={eyebrow}
        heading="Mon compte"
        lead="Tes réglages valent pour tous tes clubs."
      />
      {/* En large : compte + clubs à gauche, notifications (longues) à droite. */}
      <div className={shared.columns}>
        <AccountSettingsSection />
        <div className={shared.tall}>
          <NotificationPreferencesSection showCoachSummary={isStaffSomewhere} />
        </div>
        <MyClubsSection />
      </div>
      <AccountExitSection />
    </div>
  );
}
