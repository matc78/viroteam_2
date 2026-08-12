"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";

type PostAuthRedirectOptions = {
  /** Query `from=signup` sur access-denied pour les non-admins. */
  accessDeniedFromSignup?: boolean;
};

/**
 * Redirige après connexion : admin → dashboard (ou `next`), sinon access-denied.
 */
export function usePostAuthRedirect(options?: PostAuthRedirectOptions): void {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, isAdmin } = useAuth();

  useEffect(() => {
    if (status !== "signedIn") return;

    if (isAdmin) {
      const nextPath = searchParams.get("next");
      const isSafeRedirect =
        nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//");
      router.replace(isSafeRedirect ? nextPath : "/home");
      return;
    }

    const accessDeniedPath = options?.accessDeniedFromSignup
      ? "/access-denied?from=signup"
      : "/access-denied";
    router.replace(accessDeniedPath);
  }, [status, isAdmin, router, searchParams, options?.accessDeniedFromSignup]);
}
