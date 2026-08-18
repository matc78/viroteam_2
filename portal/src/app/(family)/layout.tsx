import { FamilyGuard } from "@/components/auth/FamilyGuard";
import { ClubIdFromUrlSync } from "@/components/dashboard/ClubIdFromUrlSync";
import { FamilyAudienceProvider } from "@/components/family/FamilyAudienceProvider";
import { FamilyShell } from "@/components/family/FamilyShell";
import { ReactNode, Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Layout espace famille : garde parent + coquille (nav distincte du bureau).
 */
export default function FamilyLayout({ children }: { children: ReactNode }) {
  return (
    <FamilyGuard>
      <Suspense fallback={null}>
        <ClubIdFromUrlSync />
      </Suspense>
      <FamilyShell>
        <FamilyAudienceProvider>{children}</FamilyAudienceProvider>
      </FamilyShell>
    </FamilyGuard>
  );
}
