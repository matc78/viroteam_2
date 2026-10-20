#!/usr/bin/env node
/**
 * Purge one-shot des comptes Firebase Auth orphelins / bot-like.
 *
 * Critères (tous doivent être vrais pour être candidat) :
 * - provider Google (google.com)
 * - e-mail type prenom.nom.chiffres@gmail.com OU lastSignIn ≈ created (session unique)
 * - aucune fiche « réelle » sur les bases Firestore ciblées :
 *   pas de users/{uid}, ou fiche sans clubMemberships ni parentLinks
 *
 * Usage :
 *   node tool/cleanup_orphan_auth_users.mjs
 *   node tool/cleanup_orphan_auth_users.mjs --dry-run
 *   node tool/cleanup_orphan_auth_users.mjs --apply
 *   node tool/cleanup_orphan_auth_users.mjs --apply --databases=v2-prod,v2-dev
 *   node tool/cleanup_orphan_auth_users.mjs --days=60 --allowlist=moi@club.fr
 *
 * Credentials Admin (une des options) :
 *   GOOGLE_APPLICATION_CREDENTIALS=/chemin/sa.json
 *   FIREBASE_ADMIN_KEY_PATH=portal/firebase-adminsdk.json
 *
 * Exit 0 si OK, 1 en cas d’erreur.
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Pattern bots observés : leslie.nichols.55802@gmail.com */
const BOT_GMAIL_PATTERN = /^[a-z0-9]+\.[a-z0-9]+\.\d{4,6}@gmail\.com$/i;

/** Écart max (ms) créé ≈ dernière connexion pour « jamais réutilisé ». */
const SINGLE_SESSION_MAX_MS = 5 * 60 * 1000;

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let apply = false;
  let days = null;
  let databases = ["v2-prod"];
  const allowlist = new Set();

  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--dry-run") {
      apply = false;
      continue;
    }
    if (arg.startsWith("--days=")) {
      const value = Number(arg.slice("--days=".length));
      if (!Number.isFinite(value) || value <= 0) {
        fail(`--days invalide : ${arg}`);
      }
      days = value;
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
    if (arg.startsWith("--allowlist=")) {
      for (const email of arg.slice("--allowlist=".length).split(",")) {
        const normalized = email.trim().toLowerCase();
        if (normalized) allowlist.add(normalized);
      }
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node tool/cleanup_orphan_auth_users.mjs [options]
  --dry-run          Liste sans supprimer (défaut)
  --apply            Supprime Auth (+ doc users si présent)
  --databases=ids    Bases Firestore (défaut: v2-prod)
  --days=N           Uniquement créés depuis N jours
  --allowlist=a,b    E-mails à ne jamais toucher`);
      process.exit(0);
    }
    fail(`Option inconnue : ${arg} (voir --help)`);
  }

  return { apply, days, databases, allowlist };
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

function isBotLikeEmail(email) {
  if (!email) return false;
  return BOT_GMAIL_PATTERN.test(email.trim());
}

function isSingleSessionUser(userRecord) {
  const created = userRecord.metadata?.creationTime
    ? Date.parse(userRecord.metadata.creationTime)
    : NaN;
  const lastSignIn = userRecord.metadata?.lastSignInTime
    ? Date.parse(userRecord.metadata.lastSignInTime)
    : NaN;
  if (!Number.isFinite(created) || !Number.isFinite(lastSignIn)) return false;
  return Math.abs(lastSignIn - created) <= SINGLE_SESSION_MAX_MS;
}

function hasGoogleProvider(userRecord) {
  return (userRecord.providerData ?? []).some(
    (provider) => provider.providerId === "google.com",
  );
}

function profileLooksReal(data) {
  if (!data) return false;
  const memberships = data.clubMemberships;
  if (Array.isArray(memberships) && memberships.length > 0) return true;
  const parentLinks = data.parentLinks;
  if (Array.isArray(parentLinks) && parentLinks.length > 0) return true;
  return false;
}

async function listAllAuthUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { admin, getFirestore } = loadAdminModules();
  const credentials = resolveCredentials();
  const app = initAdmin(admin, credentials);

  const auth = admin.auth();
  const firestores = options.databases.map((databaseId) => ({
    databaseId,
    db: getFirestore(app, databaseId),
  }));

  console.log(
    `Mode : ${options.apply ? "APPLY (suppressions)" : "DRY-RUN (aucune suppression)"}`,
  );
  console.log(`Bases Firestore : ${options.databases.join(", ")}`);
  if (options.days != null) {
    console.log(`Fenêtre : créés depuis ≤ ${options.days} jours`);
  }
  if (options.allowlist.size > 0) {
    console.log(`Allowlist : ${[...options.allowlist].join(", ")}`);
  }
  console.log(`Credentials : ${credentials.path}`);
  console.log("");

  const cutoffMs =
    options.days != null ? Date.now() - options.days * 24 * 60 * 60 * 1000 : null;

  const allUsers = await listAllAuthUsers(auth);
  const candidates = [];
  let skippedReal = 0;
  let skippedAllowlist = 0;
  let skippedNotBotLike = 0;
  let skippedTooOld = 0;

  for (const user of allUsers) {
    const email = (user.email ?? "").trim().toLowerCase();
    if (email && options.allowlist.has(email)) {
      skippedAllowlist += 1;
      continue;
    }

    if (cutoffMs != null) {
      const created = user.metadata?.creationTime
        ? Date.parse(user.metadata.creationTime)
        : NaN;
      if (!Number.isFinite(created) || created < cutoffMs) {
        skippedTooOld += 1;
        continue;
      }
    }

    if (!hasGoogleProvider(user)) {
      skippedNotBotLike += 1;
      continue;
    }

    const botEmail = isBotLikeEmail(email);
    const singleSession = isSingleSessionUser(user);
    if (!botEmail && !singleSession) {
      skippedNotBotLike += 1;
      continue;
    }

    let isReal = false;
    const profileHits = [];
    for (const { databaseId, db } of firestores) {
      const snap = await db.collection("users").doc(user.uid).get();
      if (!snap.exists) {
        profileHits.push(`${databaseId}:absent`);
        continue;
      }
      if (profileLooksReal(snap.data())) {
        isReal = true;
        profileHits.push(`${databaseId}:réel`);
        break;
      }
      profileHits.push(`${databaseId}:orphelin`);
    }

    if (isReal) {
      skippedReal += 1;
      continue;
    }

    candidates.push({
      uid: user.uid,
      email: email || "(sans e-mail)",
      created: user.metadata?.creationTime ?? "?",
      lastSignIn: user.metadata?.lastSignInTime ?? "?",
      reasons: [
        botEmail ? "email-bot" : null,
        singleSession ? "session-unique" : null,
      ].filter(Boolean),
      profiles: profileHits.join(", "),
    });
  }

  console.log(`Auth users scannés : ${allUsers.length}`);
  console.log(`Candidats         : ${candidates.length}`);
  console.log(`Ignorés (réels)   : ${skippedReal}`);
  console.log(`Ignorés (allow)   : ${skippedAllowlist}`);
  console.log(`Ignorés (filtre)  : ${skippedNotBotLike}`);
  if (cutoffMs != null) {
    console.log(`Ignorés (trop vieux) : ${skippedTooOld}`);
  }
  console.log("");

  for (const candidate of candidates) {
    console.log(
      `- ${candidate.email}  uid=${candidate.uid}  created=${candidate.created}  reasons=${candidate.reasons.join("+")}  [${candidate.profiles}]`,
    );
  }

  if (!options.apply) {
    console.log(
      "\nDry-run terminé. Relance avec --apply pour supprimer Auth + docs users orphelins.",
    );
    return;
  }

  if (candidates.length === 0) {
    console.log("Rien à supprimer.");
    return;
  }

  let deleted = 0;
  let errors = 0;
  for (const candidate of candidates) {
    try {
      for (const { db } of firestores) {
        const ref = db.collection("users").doc(candidate.uid);
        const snap = await ref.get();
        if (snap.exists && !profileLooksReal(snap.data())) {
          await ref.delete();
        }
      }
      await auth.deleteUser(candidate.uid);
      deleted += 1;
      console.log(`✓ supprimé ${candidate.email} (${candidate.uid})`);
    } catch (error) {
      errors += 1;
      console.error(
        `✗ échec ${candidate.email} (${candidate.uid}) : ${error?.message ?? error}`,
      );
    }
  }

  console.log(`\nSupprimés : ${deleted} / ${candidates.length} (erreurs : ${errors})`);
  if (errors > 0) process.exit(1);
}

main().catch((error) => {
  fail(error?.stack ?? String(error));
});
