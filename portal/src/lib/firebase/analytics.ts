"use client";

import { Analytics, getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { getFirebaseApp } from "./app";

let analyticsInstance: Analytics | null = null;

/// Initialise Firebase Analytics (côté client uniquement).
export async function initAnalytics(): Promise<Analytics | null> {
  if (analyticsInstance) return analyticsInstance;
  const supported = await isSupported();
  if (!supported) return null;
  analyticsInstance = getAnalytics(getFirebaseApp());
  return analyticsInstance;
}

/// Log un événement custom vers Firebase Analytics.
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!analyticsInstance) return;
  logEvent(analyticsInstance, eventName, params);
}
