#!/usr/bin/env node
/**
 * Backfill one-shot des rosters et de `members.teamIds`, qui étaient réparés
 * à chaque session admin / coach côté client (`reconcileMemberTeamIds` portail,
 * `reconcileStaleRosterIds` app). Depuis le 27 oct. 2026, la Function
 * `onTeamWritten` maintient `members.teamIds` à chaque écriture d'équipe et
 * `acceptInvitation` remplace le `memberId` pré-créé par l'uid dans les
 * rosters ; ce script aligne une fois les données plus anciennes :
 * - rosters `playerIds` / `coachIds` : `memberId` → `accountUid` si lié ;
 * - `members.teamIds` = équipes dont un roster contient la fiche.
 *
 * Usage :
 *   node tool/backfill_member_team_ids.mjs                    # dry-run, v2-dev
 *   node tool/backfill_member_team_ids.mjs --apply --databases=v2-dev,v2-prod
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
      console.log(`Usage: node tool/backfill_member_team_ids.mjs [options]
  --dry-run          Affiche les changements sans écrire (défaut)
  --apply            Écrit rosters et teamIds
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

function ids(raw) {
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
}

function sameIds(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

async function backfillClub(firestore, clubRef, apply) {
  const [teamsSnap, membersSnap] = await Promise.all([
    clubRef.collection("teams").get(),
    clubRef.collection("members").get(),
  ]);
  const members = membersSnap.docs.map((doc) => {
    const data = doc.data();
    const accountUid = String(data.accountUid ?? data.userId ?? "").trim() || null;
    return { ref: doc.ref, memberId: doc.id, accountUid, teamIds: ids(data.teamIds) };
  });
  const preferred = new Map(
    members
      .filter((m) => m.accountUid && m.accountUid !== m.memberId)
      .map((m) => [m.memberId, m.accountUid]),
  );
  const normalize = (list) => [...new Set(list.map((id) => preferred.get(id) ?? id))];

  const writes = [];
  const teamIdsByRosterId = new Map();
  for (const teamDoc of teamsSnap.docs) {
    const data = teamDoc.data();
    const playerIds = normalize(ids(data.playerIds));
    const coachIds = normalize(ids(data.coachIds));
    if (!sameIds(playerIds, ids(data.playerIds)) || !sameIds(coachIds, ids(data.coachIds))) {
      writes.push([teamDoc.ref, { playerIds, coachIds }]);
    }
    for (const rosterId of [...playerIds, ...coachIds]) {
      const set = teamIdsByRosterId.get(rosterId) ?? new Set();
      set.add(teamDoc.id);
      teamIdsByRosterId.set(rosterId, set);
    }
  }
  for (const member of members) {
    const expected = new Set();
    for (const id of [member.memberId, member.accountUid].filter(Boolean)) {
      for (const teamId of teamIdsByRosterId.get(id) ?? []) expected.add(teamId);
    }
    const next = [...expected].sort();
    if (sameIds(next, [...member.teamIds].sort())) continue;
    writes.push([member.ref, { teamIds: next }]);
  }

  for (const [ref, patch] of writes) {
    console.log(`${ref.path} → ${JSON.stringify(patch)}`);
  }
  if (apply) {
    for (let i = 0; i < writes.length; i += 400) {
      const batch = firestore.batch();
      for (const [ref, patch] of writes.slice(i, i + 400)) batch.update(ref, patch);
      await batch.commit();
    }
  }
  return writes.length;
}

async function main() {
  const { apply, databases } = parseArgs(process.argv.slice(2));
  const { admin, getFirestore } = loadAdminModules();
  const app = initAdmin(admin, resolveCredentials());

  for (const databaseId of databases) {
    const firestore = getFirestore(app, databaseId);
    const clubs = await firestore.collection("clubs").get();
    let total = 0;
    for (const clubDoc of clubs.docs) {
      total += await backfillClub(firestore, clubDoc.ref, apply);
    }
    console.log(
      `${apply ? "✅" : "🔎"} ${databaseId} : ${total} document(s) ${apply ? "corrigé(s)" : "à corriger (dry-run)"} sur ${clubs.size} club(s)`,
    );
  }
}

main().catch((error) => fail(error?.stack ?? String(error)));
