"use client";

import { FormEvent, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useToast } from "@/components/ToastProvider";
import styles from "./StripeFeeCheckout.module.css";

type StripeFeeCheckoutProps = {
  clientSecret: string;
  publishableKey: string;
  onClose: () => void;
  onPaid: () => void;
};

const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

/** Charge Stripe.js une fois par clé publique. */
function stripePromiseFor(publishableKey: string): Promise<Stripe | null> {
  let cached = stripePromiseCache.get(publishableKey);
  if (!cached) {
    cached = loadStripe(publishableKey);
    stripePromiseCache.set(publishableKey, cached);
  }
  return cached;
}

/** Formulaire Payment Element (CB + Apple Pay / Google Pay). */
function StripeCheckoutForm({
  onClose,
  onPaid,
}: {
  onClose: () => void;
  onPaid: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}${window.location.pathname}`,
        },
      });
      if (result.error) {
        showToast(
          result.error.message ?? "Paiement refusé ou annulé.",
          "error",
        );
        return;
      }
      showToast(
        "Paiement envoyé. Le statut se mettra à jour après confirmation.",
        "success",
      );
      onPaid();
      onClose();
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Erreur lors du paiement.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
      <PaymentElement
        options={{
          layout: "tabs",
          paymentMethodOrder: ["card", "apple_pay", "google_pay"],
          wallets: {
            applePay: "auto",
            googlePay: "auto",
          },
        }}
      />
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          onClick={onClose}
          disabled={submitting}
        >
          Annuler
        </button>
        <button
          type="submit"
          className={styles.primary}
          disabled={!stripe || !elements || submitting}
        >
          {submitting ? "Paiement…" : "Payer"}
        </button>
      </div>
    </form>
  );
}

/**
 * Modale de paiement cotisation via Stripe Payment Element.
 * Le marquage `paye` reste réservé au webhook Functions.
 */
export function StripeFeeCheckout({
  clientSecret,
  publishableKey,
  onClose,
  onPaid,
}: StripeFeeCheckoutProps) {
  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stripe-fee-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="stripe-fee-title" className={styles.title}>
          Payer la cotisation
        </h2>
        <p className={styles.lead}>
          Carte, Apple Pay ou Google Pay. Le statut se met à jour après
          confirmation serveur.
        </p>
        <Elements
          stripe={stripePromiseFor(publishableKey)}
          options={{
            clientSecret,
            appearance: { theme: "stripe" },
            locale: "fr",
          }}
        >
          <StripeCheckoutForm onClose={onClose} onPaid={onPaid} />
        </Elements>
      </div>
    </div>
  );
}
