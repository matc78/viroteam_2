"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { initPostHog, posthog } from "@/lib/posthog";
import styles from "./CookieConsent.module.css";

const CONSENT_KEY = "viro.cookieConsent";

type ConsentValue = "accepted" | "declined";

function readConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(CONSENT_KEY);
  if (value === "accepted" || value === "declined") return value;
  return null;
}

/** Bannière cookies minimale (PostHog) — pas de CMP tiers. */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = readConsent();
    if (existing === "accepted") {
      initPostHog();
      setVisible(false);
      return;
    }
    if (existing === "declined") {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, []);

  function accept() {
    window.localStorage.setItem(CONSENT_KEY, "accepted");
    initPostHog();
    setVisible(false);
  }

  function decline() {
    window.localStorage.setItem(CONSENT_KEY, "declined");
    if (posthog.__loaded) {
      posthog.opt_out_capturing();
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className={styles.banner} role="dialog" aria-label="Consentement cookies">
      <p className={styles.text}>
        Nous utilisons des cookies de mesure d’audience (PostHog) pour
        améliorer {`ViroTeam`}. Voir la{" "}
        <Link href="/legal/privacy" className={styles.link}>
          politique de confidentialité
        </Link>
        .
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={decline}>
          Refuser
        </button>
        <button type="button" className={styles.primary} onClick={accept}>
          Accepter
        </button>
      </div>
    </div>
  );
}
