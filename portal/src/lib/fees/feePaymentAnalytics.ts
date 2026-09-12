import { posthog } from "@/lib/posthog";

const STARTED_EVENT = "fee_payment_started";
const SUBMITTED_EVENT = "fee_payment_submitted";
const CANCELLED_EVENT = "fee_payment_cancelled";
const FAILED_EVENT = "fee_payment_failed";
const CONNECT_STARTED_EVENT = "fee_connect_started";
const CONNECT_FAILED_EVENT = "fee_connect_failed";

const SURFACE_PORTAL = "portal";

/** Capture PostHog best-effort (no-op si SDK non chargé / opt-out). */
function capture(
  eventName: string,
  properties: Record<string, string | number | boolean>,
): void {
  try {
    if (!posthog.__loaded) return;
    posthog.capture(eventName, properties);
  } catch {
    // L'analytics ne doit jamais bloquer le paiement.
  }
}

/** Code d’erreur technique sans message utilisateur ni PII. */
export function feePaymentErrorCode(err: unknown): string {
  if (err && typeof err === "object") {
    const withCode = err as { code?: unknown; name?: unknown };
    if (typeof withCode.code === "string" && withCode.code.trim()) {
      return withCode.code;
    }
    if (typeof withCode.name === "string" && withCode.name.trim()) {
      return withCode.name;
    }
  }
  if (err instanceof Error && err.name) return err.name;
  return "unknown";
}

/** Événements PostHog du parcours cotisations / Stripe (sans PII). */
export const FeePaymentAnalytics = {
  trackStarted(params: {
    amountCents: number;
    currency: string;
    aidCount?: number;
    hasSession: boolean;
  }): void {
    capture(STARTED_EVENT, {
      surface: SURFACE_PORTAL,
      amount_cents: params.amountCents,
      currency: params.currency.toLowerCase(),
      aid_count: params.aidCount ?? 0,
      has_session: params.hasSession,
    });
  },

  trackSubmitted(params: {
    amountCents?: number;
    currency?: string;
    aidCount?: number;
  }): void {
    capture(SUBMITTED_EVENT, {
      surface: SURFACE_PORTAL,
      amount_cents: params.amountCents ?? 0,
      currency: (params.currency ?? "eur").toLowerCase(),
      aid_count: params.aidCount ?? 0,
      provider: "stripe",
    });
  },

  trackCancelled(stage: "element" | "sheet" = "element"): void {
    capture(CANCELLED_EVENT, {
      surface: SURFACE_PORTAL,
      stage,
    });
  },

  trackFailed(params: {
    stage: "callable" | "sheet" | "element";
    errorCode?: string;
  }): void {
    capture(FAILED_EVENT, {
      surface: SURFACE_PORTAL,
      stage: params.stage,
      error_code: params.errorCode ?? "unknown",
    });
  },

  trackConnectStarted(): void {
    capture(CONNECT_STARTED_EVENT, {
      surface: SURFACE_PORTAL,
    });
  },

  trackConnectFailed(errorCode = "unknown"): void {
    capture(CONNECT_FAILED_EVENT, {
      surface: SURFACE_PORTAL,
      error_code: errorCode,
    });
  },
};
