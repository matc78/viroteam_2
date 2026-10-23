import test from "node:test";
import assert from "node:assert/strict";
import { withAppStoreCampaign, withPlayStoreCampaign } from "./storeLinks";

test("withPlayStoreCampaign garde l'id et ajoute le referrer UTM", () => {
  const url = new URL(
    withPlayStoreCampaign(
      "https://play.google.com/store/apps/details?id=com.viroteam.viro_team",
      "email",
      "invite",
    ),
  );
  assert.equal(url.searchParams.get("id"), "com.viroteam.viro_team");
  assert.equal(
    url.searchParams.get("referrer"),
    "utm_source=email&utm_campaign=invite",
  );
});

test("withAppStoreCampaign ajoute ct et conserve pt", () => {
  const url = new URL(
    withAppStoreCampaign(
      "https://apps.apple.com/fr/app/viroteam/id6807822265?pt=123",
      "email",
      "invite",
    ),
  );
  assert.equal(url.searchParams.get("pt"), "123");
  assert.equal(url.searchParams.get("ct"), "email_invite");
  assert.equal(url.searchParams.get("mt"), "8");
});
