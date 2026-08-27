"use client";

import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef } from "react";

type FamilyGuardProps = {
  children: ReactNode;
};

/**
 * Protège l’espace famille : login + au moins un parentLink active.
 * Sans droit parent : déconnexion + écran app (sauf admin → bureau).
 */
export function FamilyGuard({ children }: FamilyGuardProps) {
  const { status, isParent, isBureauUser, logout, setActiveSpace, profile } =
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
    if (isParent) {
      setActiveSpace("family");
      return;
    }
    if (isBureauUser) {
      router.replace("/home");
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
    isParent,
    isBureauUser,
    logout,
    router,
    pathname,
    setActiveSpace,
    profile?.firstName,
  ]);

  if (status === "loading") {
    return <AuthLoadingState />;
  }

  if (status === "signedOut" || !isParent) {
    return <AuthLoadingState message="Redirection…" />;
  }

  return <>{children}</>;
}
