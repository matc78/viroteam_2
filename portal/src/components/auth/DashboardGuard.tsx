"use client";

import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import {
  buildLoginRedirect,
  familyEquivalentPath,
} from "@/lib/auth/postAuthRedirect";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { defaultFamilyLandingPath } from "@/lib/firebase/personalPlanningService";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReactNode, Suspense, useEffect, useRef } from "react";

type DashboardGuardProps = {
  children: ReactNode;
};

/**
 * Parent sans fiche sur un lien bureau (push `/messages`, `/fees?clubId=`,
 * `/planning?…&memberId=`) → équivalent `/family/*` avec les paramètres
 * utiles ; sinon landing famille.
 */
function FamilyEquivalentRedirect() {
  const { status, isBureauUser, isParent, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status !== "signedIn") return;
    if (isBureauUser || !isParent) return;
    const target =
      familyEquivalentPath(pathname, new URLSearchParams(searchParams.toString())) ??
      defaultFamilyLandingPath(profile);
    router.replace(target);
  }, [status, isBureauUser, isParent, pathname, searchParams, router, profile]);

  return null;
}

/**
 * Protège les routes dashboard : login + fiche membre dans au moins un club.
 * Parent seul → landing famille ; sans accès → /access-denied (session conservée).
 */
export function DashboardGuard({ children }: DashboardGuardProps) {
  const { status, isBureauUser, isParent, setActiveSpace } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Chemin depuis lequel la redirection access-denied a été lancée.
  const denyingRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading" || status === "error") return;
    if (status === "signedOut") {
      denyingRef.current = null;
      // Query lue au moment de la redirection (pas de useSearchParams ici :
      // le garde enveloppe tout le layout, sans Suspense).
      router.replace(buildLoginRedirect(pathname, window.location.search));
      return;
    }
    if (isBureauUser) {
      setActiveSpace("bureau");
      return;
    }

    // Parent sans fiche membre : hors bureau (FamilyGuard gère /family).
    // FamilyEquivalentRedirect mappe vers /family/* (paramètres conservés).
    if (isParent) return;

    if (denyingRef.current === pathname) return;
    denyingRef.current = pathname;
    router.replace("/access-denied?reason=no-access");
  }, [
    status,
    isBureauUser,
    isParent,
    router,
    pathname,
    setActiveSpace,
  ]);

  if (status === "loading" || status === "error") {
    return <AuthLoadingState />;
  }

  if (status === "signedOut") {
    return <AuthLoadingState message="Redirection…" />;
  }

  if (!isBureauUser) {
    if (isParent) {
      return (
        <Suspense fallback={<AuthLoadingState message="Redirection…" />}>
          <FamilyEquivalentRedirect />
          <AuthLoadingState message="Redirection…" />
        </Suspense>
      );
    }
    return <AuthLoadingState message="Redirection…" />;
  }

  return <>{children}</>;
}
