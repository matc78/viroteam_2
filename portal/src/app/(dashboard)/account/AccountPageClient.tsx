"use client";

import { useReportPageReady } from "@/components/common/PageLoadProvider";
import { AccountPageContent } from "@/components/settings/AccountPageContent";

/** Contenu page Mon compte (espace club) — réglages globaux, hors club actif. */
export function AccountPageClient() {
  useReportPageReady(true, "/account");
  return <AccountPageContent eyebrow="Compte" />;
}
