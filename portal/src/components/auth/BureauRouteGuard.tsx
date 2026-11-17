"use client";

import { useAuth } from "@/lib/firebase/AuthProvider";
import { isBureauRouteAllowed } from "@/lib/auth/bureauPermissions";
import { useBureauCapabilities } from "@/lib/auth/useBureauCapabilities";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirige vers /home si la route bureau n’est pas ouverte par les droits du
 * compte dans le club actif. Attend la lecture de sa fiche (pas de
 * redirection pendant le chargement).
 */
export function BureauRouteGuard() {
  const { status, activeClubAccessLoading } = useAuth();
  const caps = useBureauCapabilities();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "signedIn" || activeClubAccessLoading) return;
    if (!isBureauRouteAllowed(pathname, caps)) {
      router.replace("/home");
    }
  }, [activeClubAccessLoading, caps, pathname, router, status]);

  return null;
}
