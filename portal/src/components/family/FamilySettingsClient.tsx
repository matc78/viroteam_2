"use client";

import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { AccountSettingsSection } from "@/components/settings/AccountSettingsSection";
import { NotificationPreferencesSection } from "@/components/settings/NotificationPreferencesSection";
import { useReportPageReady } from "@/components/common/PageLoadProvider";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import shared from "@/components/settings/settingsShared.module.css";

/** Contenu page Paramètres famille — compte uniquement. */
export function FamilySettingsClient() {
  useReportPageReady(true, "/family/settings");

  return (
    <div className={`${transitionStyles.page} ${shared.stack}`}>
      <DashboardPageIntro
        eyebrow="Famille"
        heading="Paramètres"
        lead="Gérer ton compte ViroTeam (avatar, e-mail, sécurité)."
      />
      <AccountSettingsSection />
      <NotificationPreferencesSection />
    </div>
  );
}
