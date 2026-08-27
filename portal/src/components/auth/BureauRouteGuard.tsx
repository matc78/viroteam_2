"use client";

import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  bureauCapabilities,
  isBureauRouteAllowed,
} from "@/lib/auth/bureauPermissions";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirige vers /home si la route bureau n’est pas autorisée pour le rôle actif.
 */
export function BureauRouteGuard() {
  const { activeClub, activeClubRole, status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "signedIn") return;
    const caps = bureauCapabilities(
      activeClubRole,
      activeClub?.coachPermissions,
    );
    if (!isBureauRouteAllowed(pathname, caps)) {
      router.replace("/home");
    }
  }, [
    activeClub?.coachPermissions,
    activeClubRole,
    pathname,
    router,
    status,
  ]);

  return null;
}
