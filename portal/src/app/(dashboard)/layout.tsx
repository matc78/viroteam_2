import { DashboardGuard } from "@/components/auth/DashboardGuard";
import { ClubIdFromUrlSync } from "@/components/dashboard/ClubIdFromUrlSync";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ReactNode, Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Layout partagé de l’espace club : garde auth + coquille (header/nav)
 * restent montés ; les modules Accueil / Membres / Planning / Cotisations
 * sont affichés/masqués sans recharger la page.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardGuard>
      <Suspense fallback={null}>
        <ClubIdFromUrlSync />
      </Suspense>
      <DashboardShell />
      {/* Slot Next.js (pages = null) : contenu réel dans DashboardModulePanels. */}
      <div hidden aria-hidden="true">
        {children}
      </div>
    </DashboardGuard>
  );
}
