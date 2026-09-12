"use client";

import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { defaultFamilyLandingPath } from "@/lib/firebase/personalPlanningService";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef } from "react";

type DashboardGuardProps = {
  children: ReactNode;
};

/**
 * Protège les routes dashboard : login + rôle bureau (admin, coach ou joueur).
 * Parent seul → landing famille ; sans accès → /access-denied (session conservée).
 */
export function DashboardGuard({ children }: DashboardGuardProps) {
  const { status, isBureauUser, isParent, setActiveSpace, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const denyingRef = useRef(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "signedOut") {
      denyingRef.current = false;
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (isBureauUser) {
      setActiveSpace("bureau");
      return;
    }

    // Parent sans rôle bureau : hors bureau (FamilyGuard gère /family).
    if (isParent) {
      router.replace(defaultFamilyLandingPath(profile));
      return;
    }

    if (denyingRef.current) return;
    denyingRef.current = true;
    router.replace("/access-denied?reason=role");
  }, [
    status,
    isBureauUser,
    isParent,
    router,
    pathname,
    setActiveSpace,
    profile,
  ]);

  if (status === "loading") {
    return <AuthLoadingState />;
  }

  if (status === "signedOut" || !isBureauUser) {
    return <AuthLoadingState message="Redirection…" />;
  }

  return <>{children}</>;
}
