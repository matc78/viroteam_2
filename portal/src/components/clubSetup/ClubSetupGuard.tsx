"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ClubSetupLoadingShell } from "@/components/clubSetup/ClubSetupShell";
import { isClubSetupPreviewEnabled } from "@/lib/clubSetup/clubSetupPreview";
import { useAuth } from "@/lib/firebase/AuthProvider";

type ClubSetupGuardProps = {
  children: ReactNode;
};

/** Garde le wizard : utilisateur connecté, ou aperçu UI en dev local. */
export function ClubSetupGuard({ children }: ClubSetupGuardProps) {
  const router = useRouter();
  const { status } = useAuth();
  const previewMode = isClubSetupPreviewEnabled();

  useEffect(() => {
    if (previewMode) return;
    if (status === "loading") return;
    if (status === "signedOut") {
      router.replace("/login?next=/club-setup");
    }
  }, [previewMode, router, status]);

  if (!previewMode) {
    if (status === "loading") {
      return <ClubSetupLoadingShell />;
    }
    if (status === "signedOut") {
      return null;
    }
  }

  return <>{children}</>;
}
