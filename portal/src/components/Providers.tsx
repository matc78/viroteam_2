"use client";

import { AuthProvider } from "@/lib/firebase/AuthProvider";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { CookieConsent } from "@/components/CookieConsent";
import { PageLoadProvider } from "@/components/common/PageLoadProvider";
import { PostHogPageView } from "@/components/PostHogProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { ChatProvider } from "@/lib/chat/ChatProvider";
import { ReactNode, Suspense } from "react";

/** Providers client (Auth Firebase + analytics + PostHog + toasts) pour le layout racine. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PageLoadProvider>
        <ChatProvider>
          <AnalyticsProvider>
            <ToastProvider>
              {children}
              <CookieConsent />
            </ToastProvider>
            {/* Isolé : useSearchParams ne doit pas suspendre (et vider côté serveur) toute l’app. */}
            <Suspense fallback={null}>
              <PostHogPageView />
            </Suspense>
          </AnalyticsProvider>
        </ChatProvider>
      </PageLoadProvider>
    </AuthProvider>
  );
}
