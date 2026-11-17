import test from "node:test";
import assert from "node:assert/strict";
import {
  helloAssoCreditsFromWebhook,
  helloAssoStateAuthorized,
} from "./helloAssoWebhookUtils";

test("helloAssoStateAuthorized : vide ou refusé n’est pas autorisé", () => {
  assert.equal(helloAssoStateAuthorized(""), false);
  assert.equal(helloAssoStateAuthorized(undefined), false);
  assert.equal(helloAssoStateAuthorized("Refused"), false);
  assert.equal(helloAssoStateAuthorized("Authorized"), true);
  assert.equal(helloAssoStateAuthorized("AuthorizedWaitingBankValidation"), true);
});

test("Order en 3 fois : seule l’échéance payée est créditée", () => {
  const credits = helloAssoCreditsFromWebhook("Order", {
    id: 99,
    amount: { total: 9000, vat: 0 },
    payments: [
      { id: 1, amount: 3000, state: "Authorized" },
      { id: 2, amount: 3000, state: "Pending" },
      { id: 3, amount: 3000, state: "" },
    ],
  });
  assert.deepEqual(credits, [{ externalPaymentId: "1", amountCents: 3000 }]);
});

test("Order sans payments[] ou montant objet : aucun crédit", () => {
  assert.deepEqual(helloAssoCreditsFromWebhook("Order", { id: 9, amount: { total: 9000 } }), []);
  assert.deepEqual(
    helloAssoCreditsFromWebhook("Payment", { id: 5, amount: { total: 10 }, state: "Authorized" }),
    [],
  );
});

test("Payment autorisé crédité sous son id, état vide ignoré", () => {
  assert.deepEqual(
    helloAssoCreditsFromWebhook("Payment", { id: 7, amount: 2500, state: "Authorized" }),
    [{ externalPaymentId: "7", amountCents: 2500 }],
  );
  assert.deepEqual(helloAssoCreditsFromWebhook("Payment", { id: 7, amount: 2500 }), []);
  assert.deepEqual(helloAssoCreditsFromWebhook("Refund", { id: 7, amount: 2500 }), []);
});
