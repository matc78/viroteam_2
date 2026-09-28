import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  boundedNetCents,
  mergeFeeAids,
  normalizeAidInputs,
  remainingDueCents,
} from "./stripeCheckoutUtils";

describe("remainingDueCents", () => {
  it("palier − payé − aides validées, jamais négatif", () => {
    assert.equal(
      remainingDueCents({
        tierAmountCents: 15000,
        feeStatus: "partiel",
        amountPaidCents: 5000,
        aids: [
          { status: "validated", amountCents: 3000 },
          { status: "pending_proof", amountCents: 9999 },
        ],
      }),
      7000,
    );
    assert.equal(
      remainingDueCents({
        tierAmountCents: 1000,
        feeStatus: "partiel",
        amountPaidCents: 2000,
        aids: [],
      }),
      0,
    );
  });

  it("exonéré → 0 ; données absentes → palier entier", () => {
    assert.equal(
      remainingDueCents({ tierAmountCents: 15000, feeStatus: "exonere", amountPaidCents: 0, aids: [] }),
      0,
    );
    assert.equal(
      remainingDueCents({ tierAmountCents: 15000, feeStatus: undefined, amountPaidCents: undefined, aids: undefined }),
      15000,
    );
  });
});

describe("boundedNetCents", () => {
  it("borne le montant client au reste dû", () => {
    assert.equal(boundedNetCents(99999, 7000), 7000);
    assert.equal(boundedNetCents(2500, 7000), 2500);
  });

  it("0 si le client ne demande rien ou envoie n'importe quoi", () => {
    assert.equal(boundedNetCents(0, 7000), 0);
    assert.equal(boundedNetCents(-50, 7000), 0);
    assert.equal(boundedNetCents("abc", 7000), 0);
    assert.equal(boundedNetCents(5000, 0), 0);
  });
});

describe("normalizeAidInputs", () => {
  it("ignore les aides invalides, plafonne à 10 et borne au reste dû", () => {
    const raw = [
      { type: "pass_sport", amountCents: 5000 },
      { type: "inconnu", amountCents: 100 },
      { type: "ancv", amountCents: 0 },
      { type: "promo", amountCents: -5 },
      "pas un objet",
      ...Array.from({ length: 12 }, () => ({ type: "other", amountCents: 100 })),
    ];
    const aids = normalizeAidInputs(raw, 3000);
    assert.equal(aids.length, 10);
    assert.equal(aids[0]!.amountCents, 3000);
    assert.equal(aids[1]!.type, "other");
  });

  it("retourne vide sans tableau", () => {
    assert.deepEqual(normalizeAidInputs(undefined, 1000), []);
  });
});

describe("mergeFeeAids", () => {
  it("remplace les aides d'une même session au lieu de les dupliquer", () => {
    const existing = [
      { id: "s1_0", amountCents: 100 },
      { id: "s2_0", amountCents: 200 },
    ];
    const merged = mergeFeeAids(existing, [{ id: "s2_0", amountCents: 250 }], "s2");
    assert.deepEqual(merged, [
      { id: "s1_0", amountCents: 100 },
      { id: "s2_0", amountCents: 250 },
    ]);
  });
});
