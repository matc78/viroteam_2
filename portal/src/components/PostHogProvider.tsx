"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { posthog } from "@/lib/posthog";

const CONSENT_KEY = "viro.cookieConsent";

/** Capture les page views PostHog si le consentement a déjà été accepté. */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
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

  return <>{children}</>;
}
