"use client";

import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { defaultBureauLandingPath } from "@/lib/firebase/personalPlanningService";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef } from "react";

type FamilyGuardProps = {
  children: ReactNode;
};

/**
 * Protège l’espace famille : login + au moins un parentLink active.
 * Sans droit parent : /access-denied (session conservée), sauf bureau → landing bureau.
 */
export function FamilyGuard({ children }: FamilyGuardProps) {
  const { status, isParent, isBureauUser, setActiveSpace, profile } = useAuth();
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
    if (isParent) {
      setActiveSpace("family");
      return;
    }
    if (isBureauUser) {
      router.replace(defaultBureauLandingPath(profile));
      return;
    }

    if (denyingRef.current) return;
    denyingRef.current = true;
    router.replace("/access-denied?reason=role");
  }, [
    status,
    isParent,
    isBureauUser,
    router,
    pathname,
    setActiveSpace,
    profile,
  ]);

  if (status === "loading") {
    return <AuthLoadingState />;
  }

  if (status === "signedOut" || !isParent) {
    return <AuthLoadingState message="Redirection…" />;
  }

  return <>{children}</>;
}
