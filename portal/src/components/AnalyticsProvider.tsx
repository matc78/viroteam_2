"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initAnalytics, trackEvent } from "@/lib/firebase/analytics";

/// Initialise Firebase Analytics et track les changements de page.
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackEvent("page_view", { page_path: pathname });
  }, [pathname]);

  return <>{children}</>;
}
