"use client";

import { AuthProvider } from "@/lib/firebase/AuthProvider";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { CookieConsent } from "@/components/CookieConsent";
import { PageLoadProvider } from "@/components/common/PageLoadProvider";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { ReactNode, Suspense } from "react";

/** Providers client (Auth Firebase + analytics + PostHog + toasts) pour le layout racine. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PageLoadProvider>
        <AnalyticsProvider>
          <Suspense fallback={null}>
            <PostHogProvider>
              <ToastProvider>
                {children}
                <CookieConsent />
              </ToastProvider>
            </PostHogProvider>
          </Suspense>
        </AnalyticsProvider>
      </PageLoadProvider>
    </AuthProvider>
  );
}
