"use client";

import { useAuth } from "@/lib/firebase/AuthProvider";
import { isFamilyRouteAllowed } from "@/lib/auth/bureauPermissions";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirige vers /family si la route famille n’est pas autorisée.
 */
export function FamilyRouteGuard() {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "signedIn") return;
    if (!isFamilyRouteAllowed(pathname)) {
      router.replace("/family");
    }
  }, [pathname, router, status]);

  return null;
}
