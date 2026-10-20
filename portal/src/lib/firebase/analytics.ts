"use client";

import type { Analytics } from "firebase/analytics";
import { getFirebaseApp } from "./app";

let analyticsInstance: Analytics | null = null;
let logEventFn: typeof import("firebase/analytics").logEvent | null = null;

/// Initialise Firebase Analytics (côté client uniquement, SDK chargé à la demande).
export async function initAnalytics(): Promise<Analytics | null> {
  if (analyticsInstance) return analyticsInstance;
  const { getAnalytics, isSupported, logEvent } = await import("firebase/analytics");
  const supported = await isSupported();
  if (!supported) return null;
  analyticsInstance = getAnalytics(getFirebaseApp());
  logEventFn = logEvent;
  return analyticsInstance;
}

/// Log un événement custom vers Firebase Analytics.
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!analyticsInstance || !logEventFn) return;
  logEventFn(analyticsInstance, eventName, params);
}
