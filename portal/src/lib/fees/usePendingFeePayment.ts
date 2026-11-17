"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PENDING_FEE_PAYMENT_TTL_MS,
  feePaymentKeyId,
  isFeePaymentPending,
  readPendingFeePayments,
  writePendingFeePayment,
  type FeePaymentKey,
  type PendingFeePayment,
} from "@/lib/fees/pendingFeePayment";

/**
 * Suit un paiement CB envoyé pour la cotisation `key` jusqu’à ce que le
 * webhook crédite (reste dû modifié) ou que le délai d’attente expire.
 * `pending` vaut true pendant ce temps : ne pas reproposer « Payer ».
 */
export function usePendingFeePayment(
  key: FeePaymentKey | null,
  currentRemainingCents: number,
): {
  pending: boolean;
  markSubmitted: (paidKey: FeePaymentKey, remainingCents: number) => void;
} {
  const keyId = key ? feePaymentKeyId(key) : null;
  const [record, setRecord] = useState<PendingFeePayment | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setRecord(keyId ? (readPendingFeePayments()[keyId] ?? null) : null);
    setNow(Date.now());
  }, [keyId]);

  // Réévalue à l’expiration du délai (le bouton revient si rien n’a crédité).
  useEffect(() => {
    if (!record) return;
    const remainingMs = record.submittedAt + PENDING_FEE_PAYMENT_TTL_MS - Date.now();
    if (remainingMs <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), remainingMs + 50);
    return () => clearTimeout(timer);
  }, [record]);

  const markSubmitted = useCallback(
    (paidKey: FeePaymentKey, remainingCents: number) => {
      const next: PendingFeePayment = {
        clubId: paidKey.clubId,
        seasonId: paidKey.seasonId,
        memberId: paidKey.memberId,
        remainingCents,
        submittedAt: Date.now(),
      };
      writePendingFeePayment(next);
      // Autre cotisation affichée entre-temps : relue au prochain retour.
      if (feePaymentKeyId(paidKey) !== keyId) return;
      setRecord(next);
      setNow(next.submittedAt);
    },
    [keyId],
  );

  return {
    pending: isFeePaymentPending(record, key, currentRemainingCents, now),
    markSubmitted,
  };
}
