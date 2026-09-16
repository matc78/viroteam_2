"use client";

import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { defaultFamilyLandingPath } from "@/lib/firebase/personalPlanningService";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReactNode, Suspense, useEffect, useRef } from "react";

type DashboardGuardProps = {
  children: ReactNode;
};

/** Redirige /messages → /family/messages pour parent-only (deep link push). */
function MessagesFamilyRedirect() {
  const { status, isBureauUser, isParent } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status !== "signedIn") return;
    if (isBureauUser || !isParent) return;
    if (pathname !== "/messages" && !pathname.startsWith("/messages/")) return;
    const query = searchParams.toString();
    router.replace(query ? `/family/messages?${query}` : "/family/messages");
  }, [status, isBureauUser, isParent, pathname, searchParams, router]);

  return null;
}

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
    // Deep link messagerie : laisser MessagesFamilyRedirect mapper vers /family/messages.
    if (isParent) {
      if (pathname === "/messages" || pathname.startsWith("/messages/")) {
        return;
      }
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

  if (status === "signedOut") {
    return <AuthLoadingState message="Redirection…" />;
  }

  if (!isBureauUser) {
    if (
      isParent &&
      (pathname === "/messages" || pathname.startsWith("/messages/"))
    ) {
      return (
        <Suspense fallback={<AuthLoadingState message="Redirection…" />}>
          <MessagesFamilyRedirect />
          <AuthLoadingState message="Redirection…" />
        </Suspense>
      );
    }
    return <AuthLoadingState message="Redirection…" />;
  }

  return <>{children}</>;
}
