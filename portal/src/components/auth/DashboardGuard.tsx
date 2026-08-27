"use client";

import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef } from "react";

type DashboardGuardProps = {
  children: ReactNode;
};

/**
 * Protège les routes dashboard : login + rôle bureau (admin, coach ou joueur).
 * Parent seul → /family ; sans accès → déconnexion + /access-denied.
 */
export function DashboardGuard({ children }: DashboardGuardProps) {
  const { status, isBureauUser, isParent, logout, setActiveSpace, profile } =
    useAuth();
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
      router.replace("/family");
      return;
    }

    if (denyingRef.current) return;
    denyingRef.current = true;
    const firstName = profile?.firstName?.trim();
    if (firstName && typeof window !== "undefined") {
      try {
        sessionStorage.setItem("viro.accessDeniedFirstName", firstName);
      } catch {
        // ignore
      }
    }
    void logout().then(() => {
      router.replace("/access-denied?reason=role");
    });
  }, [
    status,
    isBureauUser,
    isParent,
    logout,
    router,
    pathname,
    setActiveSpace,
    profile?.firstName,
  ]);

  if (status === "loading") {
    return <AuthLoadingState />;
  }

  if (status === "signedOut" || !isBureauUser) {
    return <AuthLoadingState message="Redirection…" />;
  }

  return <>{children}</>;
}
