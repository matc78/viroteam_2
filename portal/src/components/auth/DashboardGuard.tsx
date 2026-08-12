"use client";

import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

type DashboardGuardProps = {
  children: ReactNode;
};

/**
 * Protège les routes dashboard : login requis + rôle admin.
 * Non-admin → /access-denied ; non connecté → /login.
 */
export function DashboardGuard({ children }: DashboardGuardProps) {
  const { status, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "signedOut") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!isAdmin) {
      router.replace("/access-denied");
    }
  }, [status, isAdmin, router, pathname]);

  if (status === "loading") {
    return <AuthLoadingState />;
  }

  if (status === "signedOut" || !isAdmin) {
    return <AuthLoadingState message="Redirection…" />;
  }

  return <>{children}</>;
}
