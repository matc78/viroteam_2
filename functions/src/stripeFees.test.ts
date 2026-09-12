import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cardFeeCentsFromNet,
  cardGrossCentsFromNet,
} from "./stripeFees";

describe("cardGrossCentsFromNet", () => {
  it("retourne 0 pour un net nul ou négatif", () => {
    assert.equal(cardGrossCentsFromNet(0), 0);
    assert.equal(cardGrossCentsFromNet(-100), 0);
    assert.equal(cardFeeCentsFromNet(0), 0);
  });

  it("calcule ~153,56 € brut pour 150 € net (frais Stripe + 1 €)", () => {
    const gross = cardGrossCentsFromNet(15000);
    const fees = cardFeeCentsFromNet(15000);
    assert.equal(gross, 15356);
    assert.equal(fees, 356);
    assert.equal(gross - fees, 15000);
  });

  it("arrondit au centime supérieur", () => {
    const gross = cardGrossCentsFromNet(100);
    assert.ok(gross > 100);
    assert.equal(cardFeeCentsFromNet(100), gross - 100);
  });
});
