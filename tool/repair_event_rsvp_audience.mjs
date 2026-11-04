#!/usr/bin/env node
/**
 * Repair one-shot des doubles clés RSVP (memberId + accountUid) sur les events.
 *
 * Après acceptation d'invitation, reconcile canonise vers accountUid, mais
 * l'app écrivait encore sous memberId : l'UI restait coincée sur l'ancien vote.
 * Ce script migre legacy → canonical avec `preferLegacyWhenBoth` (le vote sous
 * memberId gagne s'il y a conflit), sur les events à venir (ou tous).
 *
 * Usage :
 *   node tool/repair_event_rsvp_audience.mjs
 *   node tool/repair_event_rsvp_audience.mjs --apply --databases=v2-prod
 *   node tool/repair_event_rsvp_audience.mjs --apply --club=WdkkznoBkCuaPeZ2kCXU --databases=v2-prod
 *   node tool/repair_event_rsvp_audience.mjs --apply --all-events --databases=v2-prod
 *
 * Prérequis : `npm run build` dans functions/ (charge eventAudienceMigrate.js).
 * Credentials : GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_ADMIN_KEY_PATH
 * (défaut portal/firebase-adminsdk.json).
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
  let allEvents = false;
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
    if (arg === "--all-events") {
      allEvents = true;
      continue;
    }
    if (arg.startsWith("--club=")) {
      clubId = arg.slice("--club=".length).trim() || null;
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
      console.log(`Usage: node tool/repair_event_rsvp_audience.mjs [options]
  --dry-run          Affiche les patchs sans écrire (défaut)
  --apply            Écrit les events
  --all-events       Inclut le passé (sinon date >= début du jour local)
  --club=id          Limite à un club
  --databases=ids    Bases Firestore (défaut: v2-dev)`);
      process.exit(0);
    }
    fail(`Option inconnue : ${arg} (voir --help)`);
  }
  return { apply, allEvents, databases, clubId };
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
      FieldValue: require("firebase-admin/firestore").FieldValue,
    };
  }
  fail(
    "firebase-admin introuvable. Lance `npm install` dans functions/ ou portal/.",
  );
}

function loadMigrate() {
  const migratePath = path.join(
    root,
    "functions",
    "lib",
    "eventAudienceMigrate.js",
  );
  if (!existsSync(migratePath)) {
    fail(
      "functions/lib/eventAudienceMigrate.js absent. Lance `npm run build` dans functions/.",
    );
  }
  const require = createRequire(migratePath);
  return require(migratePath);
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

function startOfTodayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Paires memberId → accountUid (uniquement si distincts). */
async function loadLinkedPairs(clubRef) {
  const accountsSnap = await clubRef.collection("member_accounts").get();
  const pairs = [];
  for (const doc of accountsSnap.docs) {
    const accountUid = doc.id;
    const memberId = String(doc.data()?.memberId ?? "").trim();
    if (!memberId || memberId === accountUid) continue;
    pairs.push({ legacyId: memberId, canonicalId: accountUid });
  }
  return pairs;
}

/** Applique un patch field-path en mémoire (pour enchaîner plusieurs paires). */
function applyPatchInMemory(state, patch, deleteSentinel) {
  const next = {
    teamMemberIds: [...state.teamMemberIds],
    rsvp: { ...state.rsvp },
    rsvpUpdatedAt: { ...state.rsvpUpdatedAt },
    seenAt: { ...state.seenAt },
  };
  for (const [key, value] of Object.entries(patch)) {
    if (key === "teamMemberIds" && Array.isArray(value)) {
      next.teamMemberIds = value;
      continue;
    }
    const match = /^(rsvp|rsvpUpdatedAt|seenAt)\.(.+)$/.exec(key);
    if (!match) continue;
    const [, field, id] = match;
    if (value === deleteSentinel) {
      delete next[field][id];
    } else {
      next[field][id] = value;
    }
  }
  return next;
}

async function repairClub(params) {
  const {
    firestore,
    clubRef,
    apply,
    allEvents,
    buildEventAudienceMigrationPatch,
    FieldValue,
    admin,
  } = params;

  const pairs = await loadLinkedPairs(clubRef);
  if (pairs.length === 0) return 0;

  let eventsQuery = clubRef.collection("events");
  if (!allEvents) {
    eventsQuery = eventsQuery.where(
      "date",
      ">=",
      admin.firestore.Timestamp.fromDate(startOfTodayLocal()),
    );
  }
  const eventsSnap = await eventsQuery.get();
  const deleteSentinel = FieldValue.delete();

  const writes = [];
  for (const eventDoc of eventsSnap.docs) {
    const data = eventDoc.data();
    if (data.canceled === true) continue;

    let state = {
      teamMemberIds: Array.isArray(data.teamMemberIds)
        ? data.teamMemberIds.filter((id) => typeof id === "string")
        : [],
      rsvp:
        data.rsvp && typeof data.rsvp === "object" ? { ...data.rsvp } : {},
      rsvpUpdatedAt:
        data.rsvpUpdatedAt && typeof data.rsvpUpdatedAt === "object"
          ? { ...data.rsvpUpdatedAt }
          : {},
      seenAt:
        data.seenAt && typeof data.seenAt === "object" ? { ...data.seenAt } : {},
    };

    const mergedPatch = {};
    for (const { legacyId, canonicalId } of pairs) {
      const step = buildEventAudienceMigrationPatch({
        teamMemberIds: state.teamMemberIds,
        rsvp: Object.keys(state.rsvp).length > 0 ? state.rsvp : null,
        rsvpUpdatedAt:
          Object.keys(state.rsvpUpdatedAt).length > 0
            ? state.rsvpUpdatedAt
            : null,
        seenAt: Object.keys(state.seenAt).length > 0 ? state.seenAt : null,
        legacyId,
        canonicalId,
        deleteField: deleteSentinel,
        preferLegacyWhenBoth: true,
      });
      if (!step) continue;
      Object.assign(mergedPatch, step);
      state = applyPatchInMemory(state, step, deleteSentinel);
    }
    if (Object.keys(mergedPatch).length === 0) continue;
    writes.push([eventDoc.ref, mergedPatch]);
  }

  for (const [ref, patch] of writes) {
    const summary = Object.keys(patch)
      .map((key) => {
        const value = patch[key];
        if (value === deleteSentinel) return `${key}=delete`;
        return `${key}=${JSON.stringify(value)}`;
      })
      .join(", ");
    console.log(`${ref.path} → ${summary}`);
  }

  if (apply) {
    for (let i = 0; i < writes.length; i += 400) {
      const batch = firestore.batch();
      for (const [ref, patch] of writes.slice(i, i + 400)) {
        batch.update(ref, patch);
      }
      await batch.commit();
    }
  }
  return writes.length;
}

async function main() {
  const { apply, allEvents, databases, clubId } = parseArgs(
    process.argv.slice(2),
  );
  const { admin, getFirestore, FieldValue } = loadAdminModules();
  const { buildEventAudienceMigrationPatch } = loadMigrate();
  const app = initAdmin(admin, resolveCredentials());

  for (const databaseId of databases) {
    const firestore = getFirestore(app, databaseId);
    const clubs = clubId
      ? [await firestore.collection("clubs").doc(clubId).get()].filter(
          (doc) => doc.exists,
        )
      : (await firestore.collection("clubs").get()).docs;
    if (clubId && clubs.length === 0) {
      fail(`Club introuvable : ${clubId} (${databaseId})`);
    }
    let total = 0;
    for (const clubDoc of clubs) {
      total += await repairClub({
        firestore,
        clubRef: clubDoc.ref,
        apply,
        allEvents,
        buildEventAudienceMigrationPatch,
        FieldValue,
        admin,
      });
    }
    console.log(
      `${apply ? "✅" : "🔎"} ${databaseId} : ${total} event(s) ${apply ? "corrigé(s)" : "à corriger (dry-run)"} sur ${clubs.length} club(s)`,
    );
  }
}

main().catch((error) => fail(error?.stack ?? String(error)));
