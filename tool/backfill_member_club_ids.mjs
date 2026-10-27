#!/usr/bin/env node
/**
 * Backfill one-shot de `users/{uid}.memberClubIds` (clubs dont le compte est
 * réellement membre), lu par les règles `users` depuis le lot « données
 * personnelles » (27 oct. 2026). Même calcul que la Function
 * `onUserWrittenSyncClubIds` : clubs de `clubMemberships` où existe
 * `member_accounts/{uid}` ou `members/{uid}`.
 *
 * Ordre de déploiement : Functions (trigger) → ce script en --apply → règles.
 *
 * Usage :
 *   node tool/backfill_member_club_ids.mjs                    # dry-run, v2-dev
 *   node tool/backfill_member_club_ids.mjs --apply --databases=v2-dev,v2-prod
 *
 * Credentials Admin : GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_ADMIN_KEY_PATH
 * (défaut portal/firebase-adminsdk.json), comme cleanup_orphan_auth_users.mjs.
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let apply = false;
  let databases = ["v2-dev"];
  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--dry-run") {
      apply = false;
      continue;
    }
    if (arg.startsWith("--databases=")) {
      databases = arg
        .slice("--databases=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (databases.length === 0) fail("--databases vide");
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node tool/backfill_member_club_ids.mjs [options]
  --dry-run          Affiche les changements sans écrire (défaut)
  --apply            Écrit memberClubIds
  --databases=ids    Bases Firestore (défaut: v2-dev)`);
      process.exit(0);
    }
    fail(`Option inconnue : ${arg} (voir --help)`);
  }
  return { apply, databases };
}

function loadAdminModules() {
  const candidates = [
    path.join(root, "functions", "node_modules"),
    path.join(root, "portal", "node_modules"),
  ];
  for (const nodeModules of candidates) {
    const adminPath = path.join(nodeModules, "firebase-admin");
    if (!existsSync(adminPath)) continue;
    const require = createRequire(path.join(adminPath, "package.json"));
    return {
      admin: require("firebase-admin"),
      getFirestore: require("firebase-admin/firestore").getFirestore,
    };
  }
  fail(
    "firebase-admin introuvable. Lance `npm install` dans functions/ ou portal/.",
  );
}

function resolveCredentials() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (fromEnv && existsSync(fromEnv)) {
    return { type: "adc", path: fromEnv };
  }

  const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH?.trim();
  if (keyPath) {
    const absolute = path.isAbsolute(keyPath)
      ? keyPath
      : path.join(root, keyPath);
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

/** Ids de club déclarés (miroir de `declaredClubIds`, functions/src/userClubIdsUtils.ts). */
function declaredClubIds(clubMemberships) {
  if (!Array.isArray(clubMemberships)) return [];
  const ids = new Set();
  for (const entry of clubMemberships) {
    const clubId = String(entry?.clubId ?? "").trim();
    if (clubId) ids.add(clubId);
  }
  return [...ids].sort();
}

async function verifiedMemberClubIds(firestore, uid, clubMemberships) {
  const verified = [];
  for (const clubId of declaredClubIds(clubMemberships)) {
    const clubRef = firestore.collection("clubs").doc(clubId);
    const [accountSnap, memberSnap] = await Promise.all([
      clubRef.collection("member_accounts").doc(uid).get(),
      clubRef.collection("members").doc(uid).get(),
    ]);
    if (accountSnap.exists || memberSnap.exists) verified.push(clubId);
  }
  return verified;
}

function sameIds(current, next) {
  if (!Array.isArray(current)) return false;
  const sorted = [...new Set(current.map(String))].sort();
  return sorted.length === next.length && sorted.every((id, i) => id === next[i]);
}

async function main() {
  const { apply, databases } = parseArgs(process.argv.slice(2));
  const { admin, getFirestore } = loadAdminModules();
  const app = initAdmin(admin, resolveCredentials());

  for (const databaseId of databases) {
    const firestore = getFirestore(app, databaseId);
    const snap = await firestore.collection("users").get();
    let changed = 0;
    for (const userDoc of snap.docs) {
      const data = userDoc.data();
      const next = await verifiedMemberClubIds(firestore, userDoc.id, data.clubMemberships);
      if (sameIds(data.memberClubIds, next)) continue;
      changed += 1;
      console.log(`${databaseId} users/${userDoc.id} → [${next.join(", ")}]`);
      if (apply) await userDoc.ref.update({ memberClubIds: next });
    }
    console.log(
      `${apply ? "✅" : "🔎"} ${databaseId} : ${changed}/${snap.size} profil(s) ${apply ? "mis à jour" : "à mettre à jour (dry-run)"}`,
    );
  }
}

main().catch((error) => fail(error?.stack ?? String(error)));
