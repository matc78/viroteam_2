#!/usr/bin/env node
/**
 * Migration « une seule clé membre » : re-keye chaque fiche liée à un compte
 * (`accountUid`, ou `userId` legacy) dont l'id n'est pas l'uid, vers
 * `members/{uid}`, et réécrit toutes ses références (rosters, events,
 * guardians, parentLinks, cotisations, annonces, invitations, adminIds).
 * Reprend aussi les re-keyings interrompus (`rekeyPendingFrom`), puis supprime
 * l'ancien index `clubs/{clubId}/member_accounts` (plus lu par personne).
 *
 * Même code que les Functions : `functions/lib/memberRekey.js`.
 *
 * Usage :
 *   node tool/rekey_linked_members.mjs                                  # dry-run v2-dev
 *   node tool/rekey_linked_members.mjs --apply --databases=v2-dev
 *   node tool/rekey_linked_members.mjs --databases=v2-prod              # dry-run prod
 *   node tool/rekey_linked_members.mjs --apply --club=<clubId> --databases=v2-prod
 *   node tool/rekey_linked_members.mjs --apply --merge-duplicates --databases=v2-prod
 *
 * Prérequis prod : `app_config/mobile.minVersionAndroid/minVersionIos` ≥ 2.2.14
 * (les apps ≤ 2.2.13 écrivent leur RSVP sous l'ancien memberId).
 * Prérequis : `npm install` + `npm run build` dans functions/.
 * Credentials : GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_ADMIN_KEY_PATH
 * (défaut portal/firebase-adminsdk.json).
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const functionsDir = path.join(root, "functions");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let apply = false;
  let mergeDuplicates = false;
  let databases = ["v2-dev"];
  let clubId = null;
  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--dry-run") {
      apply = false;
      continue;
    }
    if (arg === "--merge-duplicates") {
      mergeDuplicates = true;
      continue;
    }
    if (arg.startsWith("--club=")) {
      clubId = arg.slice("--club=".length).trim() || null;
      continue;
    }
    if (arg.startsWith("--databases=") || arg.startsWith("--database=")) {
      databases = arg
        .slice(arg.indexOf("=") + 1)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (databases.length === 0) fail("--databases vide");
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node tool/rekey_linked_members.mjs [options]
  --dry-run            Affiche le plan sans écrire (défaut)
  --apply              Re-keye, réécrit les références, supprime member_accounts
  --merge-duplicates   Fusionne quand une fiche existe déjà à l'uid (sinon : signalé)
  --club=id            Limite à un club
  --databases=ids      Bases Firestore (défaut: v2-dev)`);
      process.exit(0);
    }
    fail(`Option inconnue : ${arg} (voir --help)`);
  }
  return { apply, mergeDuplicates, databases, clubId };
}

/**
 * firebase-admin et le module compilé viennent de functions/ : une seule
 * instance du SDK (les `FieldValue` de memberRekey.js doivent être reconnus).
 */
function loadModules() {
  const adminPath = path.join(functionsDir, "node_modules", "firebase-admin");
  if (!existsSync(adminPath)) {
    fail("firebase-admin introuvable. Lance `npm install` dans functions/.");
  }
  const rekeyPath = path.join(functionsDir, "lib", "memberRekey.js");
  const planPath = path.join(functionsDir, "lib", "memberRekeyPlan.js");
  if (!existsSync(rekeyPath) || !existsSync(planPath)) {
    fail("functions/lib/memberRekey.js absent. Lance `npm run build` dans functions/.");
  }
  const require = createRequire(rekeyPath);
  return {
    admin: require("firebase-admin"),
    getFirestore: require("firebase-admin/firestore").getFirestore,
    rekey: require(rekeyPath),
    plan: require(planPath),
  };
}

function resolveCredentials() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (fromEnv && existsSync(fromEnv)) {
    return { type: "adc", path: fromEnv };
  }
  const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH?.trim();
  if (keyPath) {
    const absolute = path.isAbsolute(keyPath) ? keyPath : path.join(root, keyPath);
    if (!existsSync(absolute)) {
      fail(`FIREBASE_ADMIN_KEY_PATH introuvable : ${absolute}`);
    }
    return { type: "file", path: absolute };
  }
  const portalDefault = path.join(root, "portal", "firebase-adminsdk.json");
  if (existsSync(portalDefault)) {
    return { type: "file", path: portalDefault };
  }
  fail(
    "Credentials Admin manquants. Définis GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_ADMIN_KEY_PATH (ex. portal/firebase-adminsdk.json).",
  );
}

function initAdmin(admin, credentials) {
  if (admin.apps.length > 0) return admin.app();
  if (credentials.type === "file") {
    const raw = JSON.parse(readFileSync(credentials.path, "utf8"));
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: raw.project_id,
        clientEmail: raw.client_email,
        privateKey: raw.private_key,
      }),
      projectId: raw.project_id || "viroteam-75303",
    });
  }
  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.GCLOUD_PROJECT || "viroteam-75303",
  });
}

function linkedAccount(data) {
  return String(data.accountUid ?? data.userId ?? "").trim();
}

/** État « une seule clé » d'un club : re-keyings à faire, reprises, anomalies. */
async function analyseClub(clubRef) {
  const [membersSnap, accountsSnap] = await Promise.all([
    clubRef.collection("members").get(),
    clubRef.collection("member_accounts").get(),
  ]);
  const memberIds = new Set(membersSnap.docs.map((doc) => doc.id));
  const formerIds = new Map();
  const byAccount = new Map();
  const rekeys = [];
  const pending = [];
  const accountBackfills = [];
  for (const doc of membersSnap.docs) {
    const data = doc.data();
    for (const formerId of data.formerMemberIds ?? []) formerIds.set(formerId, doc.id);
    const account = linkedAccount(data);
    if (account) {
      byAccount.set(account, [...(byAccount.get(account) ?? []), doc.id]);
      if (doc.id !== account) rekeys.push({ from: doc.id, uid: account });
      // Fiche déjà à l'uid mais liée par le seul champ legacy `userId` :
      // les clients ne lisent plus que `accountUid`.
      else if (!String(data.accountUid ?? "").trim()) accountBackfills.push(doc.id);
    }
    const pendingFrom = String(data.rekeyPendingFrom ?? "").trim();
    if (pendingFrom) pending.push({ from: pendingFrom, uid: doc.id });
  }
  const collisions = [...byAccount.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([uid, ids]) => ({ uid, ids }));
  const ghosts = [...formerIds.entries()]
    .filter(([formerId]) => memberIds.has(formerId))
    .map(([formerId, currentId]) => ({ formerId, currentId }));
  const orphanIndexes = accountsSnap.docs
    .filter((doc) => !memberIds.has(String(doc.get("memberId") ?? "")))
    .map((doc) => doc.id);
  return {
    rekeys,
    pending,
    accountBackfills,
    collisions,
    ghosts,
    orphanIndexes,
    accountIndexCount: accountsSnap.size,
  };
}

/**
 * Supprime tous les docs `member_accounts` restants du club (index compte →
 * fiche abandonné : une seule clé membre). Retourne le nombre supprimé.
 */
async function deleteAccountIndexes(firestore, clubRef) {
  const snap = await clubRef.collection("member_accounts").get();
  for (let start = 0; start < snap.docs.length; start += 400) {
    const batch = firestore.batch();
    for (const doc of snap.docs.slice(start, start + 400)) batch.delete(doc.ref);
    await batch.commit();
  }
  return snap.size;
}

/** Décision cotisation par saison pour un re-keying (dry-run). */
async function previewFees(clubRef, plan, from, uid) {
  const seasons = await clubRef.collection("fee_seasons").select().get();
  const decisions = [];
  for (const season of seasons.docs) {
    const fees = season.ref.collection("member_fees");
    const states = [];
    for (const id of [from, uid]) {
      const snap = await fees.doc(id).get();
      if (!snap.exists) {
        states.push(null);
        continue;
      }
      const events = await fees.doc(id).collection("payment_events").limit(1).get();
      states.push({ data: snap.data(), paymentEventCount: events.size });
    }
    const decision = plan.feeMoveDecision(states[0], states[1]);
    if (decision !== "none") decisions.push(`${season.id}:${decision}`);
  }
  return decisions;
}

async function runDatabase({ getFirestore, app, rekey, plan, databaseId, options }) {
  const firestore = getFirestore(app, databaseId);
  const clubsQuery = options.clubId
    ? [await firestore.collection("clubs").doc(options.clubId).get()]
    : (await firestore.collection("clubs").get()).docs;
  const totals = {
    rekeyed: 0,
    resumed: 0,
    accountBackfilled: 0,
    skipped: 0,
    feeConflicts: 0,
    remaining: 0,
    accountIndexesDeleted: 0,
    accountIndexesToDelete: 0,
  };

  for (const club of clubsQuery) {
    if (!club.exists) {
      console.warn(`  ⚠️ club ${club.id} introuvable`);
      continue;
    }
    const analysis = await analyseClub(club.ref);
    const nothing =
      analysis.rekeys.length + analysis.pending.length + analysis.collisions.length +
      analysis.accountBackfills.length +
      analysis.ghosts.length + analysis.accountIndexCount === 0;
    if (nothing) continue;
    console.log(`\n🏟️  ${club.id} (${String(club.get("name") ?? "")})`);
    for (const { uid, ids } of analysis.collisions) {
      console.log(`  ⚠️ collision : compte ${uid} → fiches ${ids.join(", ")}`);
    }
    for (const { formerId, currentId } of analysis.ghosts) {
      console.log(`  ⚠️ fiche fantôme ${formerId} (déjà re-clée vers ${currentId})`);
    }
    for (const accountUid of analysis.orphanIndexes) {
      console.log(`  ⚠️ member_accounts/${accountUid} pointe vers une fiche absente`);
    }

    for (const memberId of analysis.accountBackfills) {
      console.log(`  ＋ accountUid ← userId sur ${memberId}`);
      if (!options.apply) continue;
      await club.ref.collection("members").doc(memberId).update({ accountUid: memberId });
      totals.accountBackfilled += 1;
    }

    for (const { from, uid } of analysis.pending) {
      console.log(`  ↻ reprise ${from} → ${uid}`);
      if (!options.apply) continue;
      const report = await rekey.rewriteMemberReferences({ firestore, clubId: club.id, from, uid });
      console.log(`    ${JSON.stringify(report)}`);
      totals.resumed += 1;
      totals.feeConflicts += report.feeConflictSeasonIds.length;
    }

    for (const { from, uid } of analysis.rekeys) {
      if (!options.apply) {
        const fees = await previewFees(club.ref, plan, from, uid);
        console.log(`  → ${from} → ${uid}${fees.length > 0 ? `  cotisations ${fees.join(", ")}` : ""}`);
        continue;
      }
      const report = await rekey.rekeyMemberToAccount({
        firestore,
        clubId: club.id,
        fromMemberId: from,
        uid,
        mergeDuplicates: options.mergeDuplicates,
      });
      console.log(`  → ${from} → ${uid}  ${JSON.stringify(report)}`);
      if (report.core === "skipped") {
        totals.skipped += 1;
      } else {
        totals.rekeyed += 1;
        totals.feeConflicts += report.references?.feeConflictSeasonIds.length ?? 0;
      }
    }

    if (options.apply) {
      // Après les re-keyings (le cœur supprime déjà member_accounts/{uid}) :
      // les restes (index des fiches déjà à l'uid, orphelins) disparaissent.
      const deleted = await deleteAccountIndexes(firestore, club.ref);
      if (deleted > 0) console.log(`  🗑️ member_accounts : ${deleted} doc(s) supprimé(s)`);
      totals.accountIndexesDeleted += deleted;
      const after = await analyseClub(club.ref);
      totals.remaining +=
        after.rekeys.length + after.pending.length + after.accountBackfills.length;
    } else {
      if (analysis.accountIndexCount > 0) {
        console.log(`  🗑️ member_accounts : ${analysis.accountIndexCount} doc(s) à supprimer`);
      }
      totals.accountIndexesToDelete += analysis.accountIndexCount;
      totals.remaining +=
        analysis.rekeys.length + analysis.pending.length + analysis.accountBackfills.length;
    }
  }
  return totals;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { admin, getFirestore, rekey, plan } = loadModules();
  const app = initAdmin(admin, resolveCredentials());
  console.log(
    `${options.apply ? "✍️  APPLY" : "👀 DRY-RUN"} — bases ${options.databases.join(", ")}` +
      (options.clubId ? ` — club ${options.clubId}` : "") +
      (options.mergeDuplicates ? " — fusion des doublons" : ""),
  );
  for (const databaseId of options.databases) {
    console.log(`\n=== ${databaseId} ===`);
    const totals = await runDatabase({ getFirestore, app, rekey, plan, databaseId, options });
    console.log(`\n${databaseId} : ${JSON.stringify(totals)}`);
    if (options.apply && totals.remaining > 0) {
      console.log(
        `⚠️ ${totals.remaining} fiche(s) encore sous un autre id que leur uid (collisions / conflits à traiter).`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
