import { DashboardGuard } from "@/components/auth/DashboardGuard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ReactNode } from "react";

/**
 * Layout partagé de l’espace club : garde auth + coquille (header/nav)
 * restent montés entre Accueil / Membres / Planning / Cotisations.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardGuard>
      <DashboardShell>{children}</DashboardShell>
    </DashboardGuard>
  );
}
