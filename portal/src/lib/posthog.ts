"use client";

import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

/// Initialise PostHog (côté client uniquement, une seule fois).
export function initPostHog(): void {
  if (typeof window === "undefined") return;
  if (!POSTHOG_KEY) return;
  if (posthog.__loaded) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: false, // on gère manuellement via le provider
    capture_pageleave: true,
  });
}

export { posthog };
