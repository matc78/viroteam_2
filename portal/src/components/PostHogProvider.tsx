"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CLUB_GROUP_TYPE,
  analyticsClubProperties,
  analyticsPersonProperties,
} from "@/lib/analytics/analyticsIdentity";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { onPostHogReady, posthog, registerBaseProperties } from "@/lib/posthog";

const CONSENT_KEY = "viro.cookieConsent";

/**
 * Capture les page views PostHog si le consentement a déjà été accepté.
 * Sans enfants : à monter dans son propre `<Suspense>` (useSearchParams).
 */
export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return;
    if (window.localStorage.getItem(CONSENT_KEY) !== "accepted") return;
    const url =
      window.origin +
      pathname +
      (searchParams?.toString() ? `?${searchParams}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Aligne l’identité PostHog sur la session (une fois le consentement donné) :
 * uid Firebase + propriétés sans PII, groupe du club actif, `reset` à la
 * déconnexion. Mêmes clés que l’app mobile pour croiser web et mobile.
 */
export function PostHogIdentity() {
  const { status, user, profile, activeClub } = useAuth();
  const ready = useSyncExternalStore(
    onPostHogReady,
    () => Boolean(posthog.__loaded),
    () => false,
  );
  const signedInUid = useRef<string | null>(null);
  const sentPerson = useRef<string | null>(null);
  const sentClub = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (status === "signedOut") {
      if (signedInUid.current) {
        posthog.reset();
        registerBaseProperties();
      }
      signedInUid.current = null;
      sentPerson.current = null;
      sentClub.current = null;
      return;
    }
    if (status !== "signedIn" || !user || !profile) return;
    signedInUid.current = user.uid;
    const properties = analyticsPersonProperties(profile);
    const signature = `${user.uid}|${JSON.stringify(properties)}`;
    if (signature === sentPerson.current) return;
    sentPerson.current = signature;
    const createdAt = user.metadata.creationTime;
    posthog.identify(
      user.uid,
      properties,
      createdAt ? { signup_at: new Date(createdAt).toISOString() } : undefined,
    );
  }, [ready, status, user, profile]);

  useEffect(() => {
    if (!ready || status !== "signedIn" || !activeClub) return;
    const properties = analyticsClubProperties(activeClub);
    const signature = `${activeClub.id}|${JSON.stringify(properties)}`;
    if (signature === sentClub.current) return;
    sentClub.current = signature;
    posthog.group(CLUB_GROUP_TYPE, activeClub.id, properties);
  }, [ready, status, activeClub]);

  return null;
}
