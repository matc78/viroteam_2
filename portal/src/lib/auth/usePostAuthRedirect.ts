"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";

type PostAuthRedirectOptions = {
  /** Query `from=signup` sur access-denied pour les non-admins. */
  accessDeniedFromSignup?: boolean;
};

function isSafeRedirect(path: string | null): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

/**
 * Redirige après connexion : bureau, famille, ou access-denied.
 */
export function usePostAuthRedirect(options?: PostAuthRedirectOptions): void {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, isAdmin, isParent, activeSpace } = useAuth();

  useEffect(() => {
    if (status !== "signedIn") return;

    const nextPath = searchParams.get("next");
    if (isSafeRedirect(nextPath)) {
      const isFamilyPath = nextPath === "/family" || nextPath.startsWith("/family/");
      const isBureauPath =
        nextPath === "/home" ||
        nextPath.startsWith("/members") ||
        nextPath.startsWith("/planning") ||
        nextPath.startsWith("/fees");
      const isJoinPath = nextPath.startsWith("/join");

      if (isJoinPath) {
        router.replace(nextPath);
        return;
      }
      if (isFamilyPath && isParent) {
        router.replace(nextPath);
        return;
      }
      if (isBureauPath && isAdmin) {
        router.replace(nextPath);
        return;
      }
    }

    if (isAdmin && isParent) {
      router.replace(activeSpace === "family" ? "/family" : "/home");
      return;
    }
    if (isAdmin) {
      router.replace("/home");
      return;
    }
    if (isParent) {
      router.replace("/family");
      return;
    }

    const accessDeniedPath = options?.accessDeniedFromSignup
      ? "/access-denied?from=signup"
      : "/access-denied";
    router.replace(accessDeniedPath);
  }, [
    status,
    isAdmin,
    isParent,
    activeSpace,
    router,
    searchParams,
    options?.accessDeniedFromSignup,
  ]);
}
