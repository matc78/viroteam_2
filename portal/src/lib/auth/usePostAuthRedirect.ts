"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { resolveNextRedirect } from "@/lib/auth/postAuthRedirect";
import { isFounderSignupIntent } from "@/lib/auth/signupIntent";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  defaultBureauLandingPath,
  defaultFamilyLandingPath,
} from "@/lib/firebase/personalPlanningService";

type PostAuthRedirectOptions = {
  /** Query `from=signup` sur access-denied pour les comptes sans club. */
  accessDeniedFromSignup?: boolean;
};

/**
 * Redirige après connexion : bureau, famille, ou access-denied / onboarding.
 * Multi-profils → Mon planning ; un seul club → accueil de ce club.
 * Coach et joueur ont accès au Bureau (pages filtrées ensuite).
 */
export function usePostAuthRedirect(options?: PostAuthRedirectOptions): void {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, isBureauUser, isParent, activeSpace, profile } = useAuth();
  const denyingRef = useRef(false);

  useEffect(() => {
    if (status !== "signedIn") {
      denyingRef.current = false;
      return;
    }
    if (denyingRef.current) return;

    // Deep link conservé (query comprise) ; lien bureau d’un parent sans
    // fiche → équivalent famille.
    const nextTarget = resolveNextRedirect(searchParams.get("next"), {
      isBureauUser,
      isParent,
    });
    if (nextTarget) {
      router.replace(nextTarget);
      return;
    }

    if (isBureauUser && isParent) {
      router.replace(
        activeSpace === "family"
          ? defaultFamilyLandingPath(profile)
          : defaultBureauLandingPath(profile),
      );
      return;
    }
    if (isBureauUser) {
      router.replace(defaultBureauLandingPath(profile));
      return;
    }
    if (isParent) {
      router.replace(defaultFamilyLandingPath(profile));
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
    router.replace("/access-denied?reason=no-access");
  }, [
    status,
    isBureauUser,
    isParent,
    activeSpace,
    profile,
    router,
    searchParams,
    options?.accessDeniedFromSignup,
  ]);
}
