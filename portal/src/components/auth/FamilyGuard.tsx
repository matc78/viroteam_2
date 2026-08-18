"use client";

import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

type FamilyGuardProps = {
  children: ReactNode;
};

/**
 * Protège l’espace famille : login + au moins un parentLink active.
 */
export function FamilyGuard({ children }: FamilyGuardProps) {
  const { status, isParent, setActiveSpace } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "signedOut") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!isParent) {
      router.replace("/access-denied");
      return;
    }
    setActiveSpace("family");
  }, [status, isParent, router, pathname, setActiveSpace]);

  if (status === "loading") {
    return <AuthLoadingState />;
  }

  if (status === "signedOut" || !isParent) {
    return <AuthLoadingState message="Redirection…" />;
  }

  return <>{children}</>;
}
