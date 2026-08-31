"use client";

import { ClubSetupGuard } from "@/components/clubSetup/ClubSetupGuard";
import { ClubSetupWizard } from "@/components/clubSetup/ClubSetupWizard";

/** Wizard de création de club (5 étapes). */
export default function ClubSetupPage() {
  return (
    <ClubSetupGuard>
      <ClubSetupWizard />
    </ClubSetupGuard>
  );
}
