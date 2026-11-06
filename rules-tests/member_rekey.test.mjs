// Re-keying « une seule clé membre » (émulateur) : une fiche pré-inscrite liée
// à un compte passe sous `members/{uid}` avec toutes ses références, de façon
// reprenable (crash après le cœur) et idempotente ; les règles donnent ensuite
// les mêmes accès au titulaire et au parent.
//
// Exécute le code compilé des Functions (`functions/lib/memberRekey.js`) avec
// l'Admin SDK de functions/ : `npm ci && npm run build` dans functions/ avant.

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeTestEnvironment,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REKEY_JS = path.join(__dirname, "..", "functions", "lib", "memberRekey.js");
if (!existsSync(REKEY_JS)) {
  throw new Error(
    "functions/lib/memberRekey.js absent : lance `npm ci && npm run build` dans functions/.",
  );
}
const functionsRequire = createRequire(REKEY_JS);
const adminSdk = functionsRequire("firebase-admin");
const { getFirestore, Timestamp } = functionsRequire("firebase-admin/firestore");
const {
  readRekeyCore,
  writeRekeyCore,
  rekeyMemberToAccount,
} = functionsRequire(REKEY_JS);

const PROJECT_ID = "viroteam-rekey-test";
const CLUB = "c1";
const FROM = "mem-a";
const UID = "uid-a";
const PARENT = "parent1";
const SEASON = "s1";

let testEnv;
let firestore;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8") },
  });
  const app = adminSdk.initializeApp({ projectId: PROJECT_ID }, "rekey-test");
  firestore = getFirestore(app);
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  const club = firestore.collection("clubs").doc(CLUB);
  const past = Timestamp.fromMillis(Date.UTC(2026, 0, 10));
  const writes = [
    [club, { name: "Viro", adminIds: ["admin1", FROM], memberCount: 2 }],
    [club.collection("members").doc(FROM), {
      memberId: FROM,
      accountUid: UID,
      userId: UID,
      firstName: "Louka",
      lastName: "COCK",
      role: "player",
      status: "active",
      teamIds: ["t1"],
      snapshot: { displayName: "Louka COCK", email: "louka@x.fr" },
    }],
    [club.collection("members").doc("uid-b"), {
      memberId: "uid-b", accountUid: "uid-b", role: "player", status: "active",
    }],
    // Ancien index compte → fiche (avant migration) : supprimé par le cœur.
    [club.collection("member_accounts").doc(UID), { memberId: FROM }],
    [club.collection("members").doc(FROM).collection("guardians").doc(PARENT), {
      parentUid: PARENT, memberId: FROM, status: "active", relation: "parent",
      permissions: { canView: true, canRsvp: true, canPay: true },
    }],
    [firestore.collection("users").doc(PARENT), {
      parentLinks: [{ clubId: CLUB, memberId: FROM, relation: "parent", status: "active" }],
      parentClubIds: [CLUB],
    }],
    [firestore.collection("users").doc(UID), {
      firstName: "Louka", lastName: "COCQ", clubMemberships: [{ clubId: CLUB, role: "player" }],
      memberClubIds: [CLUB],
    }],
    [club.collection("teams").doc("t1"), { playerIds: [FROM, "uid-b"], coachIds: [FROM] }],
    [club.collection("events").doc("e-past"), {
      date: past,
      teamMemberIds: [FROM, "uid-b"],
      excludedMemberIds: [FROM],
      rsvp: { [FROM]: "yes", "uid-b": "no" },
      rsvpUpdatedAt: { [FROM]: past },
      seenAt: { [FROM]: past },
      attendance: { [FROM]: { status: "present" } },
    }],
    [club.collection("announcements").doc("a1"), { targetType: "Personnes", targetIds: [FROM] }],
    [club.collection("invitations").doc("i1"), { memberId: FROM, status: "accepted" }],
    [club.collection("fee_seasons").doc(SEASON), { label: "2026" }],
    [club.collection("fee_seasons").doc(SEASON).collection("member_fees").doc(FROM), {
      memberId: FROM, amountPaidCents: 2000, memberDisplayName: "Louka COCK",
    }],
    [club.collection("fee_seasons").doc(SEASON).collection("member_fees").doc(FROM)
      .collection("payment_events").doc("p1"), { amountCents: 2000 }],
    [club.collection("fee_seasons").doc(SEASON).collection("payment_sessions").doc("ps1"), {
      memberId: FROM, status: "pending",
    }],
  ];
  for (const [ref, data] of writes) await ref.set(data);
});

/** Lecture d'un document du club (Admin SDK). */
async function clubDoc(...segments) {
  return firestore.collection("clubs").doc(CLUB).collection(segments[0]).doc(segments[1]).get();
}

test("re-keying : reprise après le cœur, toutes les références, idempotent", async () => {
  // Crash simulé : le cœur transactionnel seul.
  await firestore.runTransaction(async (tx) => {
    const state = await readRekeyCore(tx, { firestore, clubId: CLUB, fromMemberId: FROM, uid: UID });
    writeRekeyCore(tx, state);
  });
  const moved = await clubDoc("members", UID);
  assert.equal(moved.get("rekeyPendingFrom"), FROM);
  assert.deepEqual(moved.get("formerMemberIds"), [FROM]);
  assert.equal(moved.get("lastName"), "COCK");
  assert.equal((await clubDoc("members", FROM)).exists, false);
  assert.equal((await clubDoc("member_accounts", UID)).exists, false);

  const resumed = await rekeyMemberToAccount({ firestore, clubId: CLUB, fromMemberId: FROM, uid: UID });
  assert.equal(resumed.core, "already");
  assert.deepEqual(resumed.references, {
    teams: 1,
    events: 1,
    announcements: 1,
    invitations: 1,
    paymentSessions: 1,
    feesMoved: 1,
    feesDropped: 0,
    feeConflictSeasonIds: [],
  });

  const club = firestore.collection("clubs").doc(CLUB);
  assert.deepEqual((await club.get()).get("adminIds"), ["admin1", UID]);
  const team = await clubDoc("teams", "t1");
  assert.deepEqual(team.get("playerIds"), [UID, "uid-b"]);
  assert.deepEqual(team.get("coachIds"), [UID]);
  const event = (await clubDoc("events", "e-past")).data();
  assert.deepEqual(event.teamMemberIds, [UID, "uid-b"]);
  assert.deepEqual(event.excludedMemberIds, [UID]);
  assert.deepEqual(event.rsvp, { [UID]: "yes", "uid-b": "no" });
  assert.deepEqual(Object.keys(event.seenAt), [UID]);
  assert.deepEqual(event.attendance, { [UID]: { status: "present" } });
  assert.ok(event.silentWriteAt, "écriture silencieuse : pas de push");
  assert.deepEqual((await clubDoc("announcements", "a1")).get("targetIds"), [UID]);
  assert.equal((await clubDoc("invitations", "i1")).get("memberId"), UID);
  const guardian = await club.collection("members").doc(UID).collection("guardians").doc(PARENT).get();
  assert.equal(guardian.get("memberId"), UID);
  const parent = await firestore.collection("users").doc(PARENT).get();
  assert.deepEqual(parent.get("parentLinks"), [
    { clubId: CLUB, memberId: UID, relation: "parent", status: "active" },
  ]);
  const season = club.collection("fee_seasons").doc(SEASON);
  const fee = await season.collection("member_fees").doc(UID).get();
  assert.equal(fee.get("amountPaidCents"), 2000);
  assert.equal(fee.get("memberId"), UID);
  assert.equal((await season.collection("member_fees").doc(UID).collection("payment_events").doc("p1").get()).exists, true);
  assert.equal((await season.collection("member_fees").doc(FROM).get()).exists, false);
  assert.equal((await season.collection("payment_sessions").doc("ps1").get()).get("memberId"), UID);
  assert.equal((await clubDoc("members", UID)).get("rekeyPendingFrom"), undefined);

  const again = await rekeyMemberToAccount({ firestore, clubId: CLUB, fromMemberId: FROM, uid: UID });
  assert.equal(again.core, "already");
  assert.deepEqual(again.references, {
    teams: 0,
    events: 0,
    announcements: 0,
    invitations: 0,
    paymentSessions: 0,
    feesMoved: 0,
    feesDropped: 0,
    feeConflictSeasonIds: [],
  });
  // L'ancien id ne survit que dans `formerMemberIds` (traçabilité).
  assert.deepEqual((await clubDoc("members", UID)).get("formerMemberIds"), [FROM]);
  assert.equal((await clubDoc("member_accounts", UID)).exists, false);
});

test("re-keying : une fiche déjà à l'uid est signalée sans --merge-duplicates", async () => {
  await firestore.collection("clubs").doc(CLUB).collection("members").doc(UID).set({
    memberId: UID, accountUid: UID, role: "coach", status: "active", teamIds: ["t2"],
  });
  const skipped = await rekeyMemberToAccount({ firestore, clubId: CLUB, fromMemberId: FROM, uid: UID });
  assert.deepEqual(skipped, { core: "skipped", skippedReason: "collision" });
  assert.equal((await clubDoc("members", FROM)).exists, true);

  const merged = await rekeyMemberToAccount({
    firestore, clubId: CLUB, fromMemberId: FROM, uid: UID, mergeDuplicates: true,
  });
  assert.equal(merged.core, "merged");
  const member = await clubDoc("members", UID);
  assert.equal(member.get("role"), "coach");
  assert.deepEqual(member.get("teamIds"), ["t1", "t2"]);
  assert.equal((await firestore.collection("clubs").doc(CLUB).get()).get("memberCount"), 1);
});

test("après re-keying, le titulaire et le parent gardent leurs accès", async () => {
  await rekeyMemberToAccount({ firestore, clubId: CLUB, fromMemberId: FROM, uid: UID });

  const owner = testEnv.authenticatedContext(UID, { email: "louka@x.fr", email_verified: true }).firestore();
  await assertSucceeds(updateDoc(doc(owner, `clubs/${CLUB}/members/${UID}`), { lastName: "COCQ" }));
  await assertSucceeds(getDoc(doc(owner, `clubs/${CLUB}/fee_seasons/${SEASON}/member_fees/${UID}`)));

  const parent = testEnv.authenticatedContext(PARENT, { email: "parent@x.fr", email_verified: true }).firestore();
  await assertSucceeds(getDoc(doc(parent, `clubs/${CLUB}/members/${UID}/guardians/${PARENT}`)));
  await assertSucceeds(getDoc(doc(parent, `clubs/${CLUB}/fee_seasons/${SEASON}/member_fees/${UID}`)));
});
