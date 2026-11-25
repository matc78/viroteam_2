import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatVenueAddress,
  isVenueEnrichment,
  parseMatchSheetVenue,
  preferVenue,
  venueLooksComplete,
} from "./ffvbMatchSheet";

const fixturesDir = join(__dirname, "..", "..", "src", "federation", "__fixtures__");
const pdf = readFileSync(join(fixturesDir, "fiche_1MBA026.pdf"));

test("venueLooksComplete détecte une adresse avec chiffre", () => {
  assert.equal(venueLooksComplete("PERDREAU"), false);
  assert.equal(venueLooksComplete("1 BIS RUE PERDREAU, 78390 BOIS D'ARCY"), true);
  assert.equal(venueLooksComplete(null), false);
});

test("formatVenueAddress assemble nom + rue + ville sans doublon", () => {
  assert.equal(
    formatVenueAddress("PERDREAU", {
      name: "PERDREAU",
      street: "1 BIS RUE PERDREAU",
      city: "78390 BOIS D'ARCY",
    }),
    "PERDREAU, 1 BIS RUE PERDREAU, 78390 BOIS D'ARCY",
  );
});

test("preferVenue garde l'adresse complète face au nom court", () => {
  assert.equal(
    preferVenue("PERDREAU", "PERDREAU, 1 BIS RUE PERDREAU, 78390 BOIS D'ARCY"),
    "PERDREAU, 1 BIS RUE PERDREAU, 78390 BOIS D'ARCY",
  );
  assert.equal(preferVenue("GAILLON", null), "GAILLON");
  assert.equal(preferVenue(null, "GAILLON"), "GAILLON");
  // Vrai changement de salle : la fédé l'emporte sur l'ancienne adresse.
  assert.equal(
    preferVenue("GAILLON", "PERDREAU, 1 BIS RUE PERDREAU, 78390 BOIS D'ARCY"),
    "GAILLON",
  );
});

test("isVenueEnrichment reconnaît un passage nom → adresse", () => {
  assert.equal(
    isVenueEnrichment("PERDREAU", "PERDREAU, 1 BIS RUE PERDREAU, 78390 BOIS D'ARCY"),
    true,
  );
  assert.equal(
    isVenueEnrichment("GAILLON", "GYMNASE DU CHAMP DES OISEAUX"),
    false,
  );
});

test("parseMatchSheetVenue lit l'adresse du PDF fiche 1MBA026", () => {
  const address = parseMatchSheetVenue(pdf);
  assert.deepEqual(address, {
    name: "PERDREAU",
    street: "1 BIS RUE PERDREAU",
    city: "78390 BOIS D'ARCY",
  });
});
