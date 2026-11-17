import { describe, expect, it } from "vitest";
import {
  PENDING_FEE_PAYMENT_TTL_MS,
  isFeePaymentPending,
  type PendingFeePayment,
} from "./pendingFeePayment";

const key = { clubId: "c1", seasonId: "s1", memberId: "m1" };
const pending: PendingFeePayment = {
  ...key,
  remainingCents: 12000,
  submittedAt: 1_000,
};

describe("isFeePaymentPending", () => {
  it("bloque un second paiement tant que le reste dû n’a pas bougé", () => {
    expect(isFeePaymentPending(pending, key, 12000, 2_000)).toBe(true);
  });

  it("libère dès que le webhook a crédité", () => {
    expect(isFeePaymentPending(pending, key, 0, 2_000)).toBe(false);
    expect(isFeePaymentPending(pending, key, 5000, 2_000)).toBe(false);
  });

  it("ne concerne que la même cotisation", () => {
    expect(
      isFeePaymentPending(pending, { ...key, memberId: "m2" }, 12000, 2_000),
    ).toBe(false);
    expect(isFeePaymentPending(pending, null, 12000, 2_000)).toBe(false);
  });

  it("expire après le délai d’attente", () => {
    expect(
      isFeePaymentPending(
        pending,
        key,
        12000,
        pending.submittedAt + PENDING_FEE_PAYMENT_TTL_MS,
      ),
    ).toBe(false);
  });
});
