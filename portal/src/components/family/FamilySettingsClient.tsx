"use client";

import { useReportPageReady } from "@/components/common/PageLoadProvider";
import { AccountPageContent } from "@/components/settings/AccountPageContent";

/** Contenu page Paramètres famille — mêmes réglages globaux que `/account`. */
export function FamilySettingsClient() {
  useReportPageReady(true, "/family/settings");
  return <AccountPageContent eyebrow="Compte" />;
}
