"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { isFounderSignupIntent } from "@/lib/auth/signupIntent";
import { useAuth } from "@/lib/firebase/AuthProvider";

type PostAuthRedirectOptions = {
  /** Query `from=signup` sur access-denied pour les comptes sans club. */
  accessDeniedFromSignup?: boolean;
};

function isSafeRedirect(path: string | null): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

/**
 * Redirige après connexion : bureau, famille, ou access-denied / onboarding.
 * Coach et joueur ont accès au Bureau (pages filtrées ensuite).
 */
export function usePostAuthRedirect(options?: PostAuthRedirectOptions): void {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, isBureauUser, isParent, activeSpace } = useAuth();
  const denyingRef = useRef(false);

  useEffect(() => {
    if (status !== "signedIn") {
      denyingRef.current = false;
      return;
    }
    if (denyingRef.current) return;

    const nextPath = searchParams.get("next");
    if (isSafeRedirect(nextPath)) {
      const isFamilyPath = nextPath === "/family" || nextPath.startsWith("/family/");
      const isBureauPath =
        nextPath === "/home" ||
        nextPath.startsWith("/members") ||
        nextPath.startsWith("/planning") ||
        nextPath.startsWith("/fees") ||
        nextPath.startsWith("/announcements");
      const isJoinPath = nextPath.startsWith("/join");
      const isClubSetupPath = nextPath.startsWith("/club-setup");

      if (isClubSetupPath) {
        router.replace(nextPath);
        return;
      }
      if (isJoinPath) {
        router.replace(nextPath);
        return;
      }
      if (isFamilyPath && isParent) {
        router.replace(nextPath);
        return;
      }
      if (isBureauPath && isBureauUser) {
        router.replace(nextPath);
        return;
      }
    }

    if (isBureauUser && isParent) {
      router.replace(activeSpace === "family" ? "/family" : "/home");
      return;
    }
    if (isBureauUser) {
      router.replace("/home");
      return;
    }
    if (isParent) {
      router.replace("/family");
      return;
    }

    // Signup fondateur sans club : wizard création.
    if (options?.accessDeniedFromSignup && isFounderSignupIntent()) {
      router.replace("/club-setup");
      return;
    }

    // Signup sans club : onboarding join (reste connecté).
    if (options?.accessDeniedFromSignup) {
      router.replace("/access-denied?from=signup");
      return;
    }

    denyingRef.current = true;
    router.replace("/access-denied?reason=role");
  }, [
    status,
    isBureauUser,
    isParent,
    activeSpace,
    router,
    searchParams,
    options?.accessDeniedFromSignup,
  ]);
}
