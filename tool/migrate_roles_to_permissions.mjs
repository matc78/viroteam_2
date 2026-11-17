#!/usr/bin/env node
/**
 * Migration « rôles → droits » : seule `members/{id}.permissions` fait foi.
 *
 * Phase additive (défaut) — relançable, l'ancien champ `role` est conservé :
 *   - `members.permissions` : admin (ou uid dans l'ancien `adminIds`) →
 *     ['admin'] ; coach → modèle Entraîneur (+ `viewFees` si le club avait
 *     `coachPermissions.canViewFees`) ; joueur → [] ;
 *   - `members.coachTeamIds` : équipes entraînées, d'après `teams.coachIds` ;
 *   - `clubs.adminIds` : réindexé (fiches liées portant le droit admin) ;
 *   - `members.accountUid` = ancien `userId` s'il manque (seul lien au compte).
 *   Rapport : clubs sans admin lié, coachs sans équipe (ils perdent la gestion
 *   des événements et des annonces tant qu'ils ne sont pas rattachés),
 *   invitations en attente qui portaient un rôle sans fiche pré-créée, écarts
 *   entre `users.clubMemberships` et `users.memberClubIds` (seul index).
 *   Sert aussi d'outil de réparation : relancée, elle recalcule
 *   `coachTeamIds` depuis `teams.coachIds` et réindexe `adminIds`.
 *
 * Phase `--drop-legacy` (après la bascule, quand plus aucune ancienne app ne
 * tourne) : supprime `members.role`, `members.coachInfo`, `members.userId`,
 * `members.memberId`, `invitations.role`, `clubs.coachPermissions.canViewFees`,
 * `users.clubMemberships` et la collection `join_requests`.
 *
 * Même logique que les Functions : `functions/lib/permissionsMigration.js`.
 *
 * Usage :
 *   node tool/migrate_roles_to_permissions.mjs                          # dry-run v2-dev
 *   node tool/migrate_roles_to_permissions.mjs --apply --databases=v2-dev
 *   node tool/migrate_roles_to_permissions.mjs --databases=v2-prod      # dry-run prod
 *   node tool/migrate_roles_to_permissions.mjs --apply --club=<clubId> --databases=v2-prod
 *   node tool/migrate_roles_to_permissions.mjs --drop-legacy --apply --databases=v2-prod
 *
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
const BATCH_SIZE = 400;

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let apply = false;
  let dropLegacy = false;
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
    if (arg === "--drop-legacy") {
      dropLegacy = true;
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
      console.log(`Usage: node tool/migrate_roles_to_permissions.mjs [options]
  --dry-run        Affiche le plan sans écrire (défaut)
  --apply          Écrit permissions, coachTeamIds, accountUid et l'index adminIds
  --drop-legacy    Supprime les anciens champs de rôle et index v1 (après la bascule)
  --club=id        Limite à un club
  --databases=ids  Bases Firestore (défaut: v2-dev)`);
      process.exit(0);
    }
    fail(`Option inconnue : ${arg} (voir --help)`);
  }
  return { apply, dropLegacy, databases, clubId };
}

/** firebase-admin et le module compilé viennent de functions/. */
function loadModules() {
  const adminPath = path.join(functionsDir, "node_modules", "firebase-admin");
  if (!existsSync(adminPath)) {
    fail("firebase-admin introuvable. Lance `npm install` dans functions/.");
  }
  const migrationPath = path.join(functionsDir, "lib", "permissionsMigration.js");
  if (!existsSync(migrationPath)) {
    fail(
      "functions/lib/permissionsMigration.js absent. Lance `npm run build` dans functions/.",
    );
  }
  const require = createRequire(migrationPath);
  return {
    admin: require("firebase-admin"),
    getFirestore: require("firebase-admin/firestore").getFirestore,
    FieldValue: require("firebase-admin/firestore").FieldValue,
    migration: require(migrationPath),
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

/** Applique [updates] (`[ref, patch]`) par lots sous la limite Firestore. */
async function commitUpdates(firestore, updates) {
  for (let start = 0; start < updates.length; start += BATCH_SIZE) {
    const batch = firestore.batch();
    for (const [ref, patch] of updates.slice(start, start + BATCH_SIZE)) {
      batch.update(ref, patch);
    }
    await batch.commit();
  }
}

function toDocs(snapshot) {
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function clubsOf(firestore, options) {
  if (options.clubId) {
    const club = await firestore.collection("clubs").doc(options.clubId).get();
    if (!club.exists) fail(`Club ${options.clubId} introuvable`);
    return [club];
  }
  return (await firestore.collection("clubs").get()).docs;
}

/** Phase additive : droits, équipes entraînées, index des admins. */
async function migrateDatabase({ firestore, migration, options }) {
  const totals = {
    clubs: 0,
    membersPatched: 0,
    adminIndexesRewritten: 0,
    clubsWithoutLinkedAdmin: 0,
    coachesWithoutTeam: 0,
    invitationsWithRole: 0,
    accountUidBackfilled: 0,
    usersWithClubIndexGap: 0,
  };

  for (const club of await clubsOf(firestore, options)) {
    totals.clubs += 1;
    const [membersSnap, teamsSnap, invitationsSnap] = await Promise.all([
      club.ref.collection("members").get(),
      club.ref.collection("teams").get(),
      club.ref.collection("invitations").where("status", "==", "pending").get(),
    ]);
    const plan = migration.planClubMigration({
      club: club.data(),
      members: toDocs(membersSnap),
      teams: toDocs(teamsSnap),
    });
    // Une invitation ne porte plus de droits : seules celles rattachées à une
    // fiche pré-créée les transmettent (droits de la fiche).
    const orphanRoleInvites = invitationsSnap.docs.filter((doc) => {
      const role = String(doc.get("role") ?? "player");
      const memberId = String(doc.get("memberId") ?? "").trim();
      return role !== "player" && !memberId;
    });
    // `accountUid` est le seul lien fiche → compte : recopié de l'ancien `userId`.
    const accountUidBackfills = membersSnap.docs.filter((doc) => {
      const accountUid = String(doc.get("accountUid") ?? "").trim();
      const userId = String(doc.get("userId") ?? "").trim();
      return !accountUid && userId.length > 0;
    });

    const { report } = plan;
    const quiet =
      accountUidBackfills.length === 0 &&
      plan.memberPatches.length === 0 &&
      plan.adminIds === null &&
      !report.noLinkedAdmin &&
      report.adminIdsWithoutMember.length === 0 &&
      report.unlinkedAdminMemberIds.length === 0 &&
      report.coachesWithoutTeam.length === 0 &&
      orphanRoleInvites.length === 0;
    if (quiet) continue;

    console.log(`\n🏟️  ${club.id} (${String(club.get("name") ?? "")})`);
    if (plan.memberPatches.length > 0) {
      const withRights = plan.memberPatches.filter(
        (patch) => patch.permissions.length > 0,
      );
      console.log(
        `  ＋ ${plan.memberPatches.length} fiche(s) à écrire, dont ${withRights.length} avec des droits`,
      );
      for (const patch of withRights) {
        console.log(`     ${patch.memberId} → [${patch.permissions.join(", ")}]`);
      }
    }
    if (plan.adminIds !== null) {
      console.log(`  ＋ adminIds → [${plan.adminIds.join(", ")}]`);
    }
    if (accountUidBackfills.length > 0) {
      console.log(`  ＋ ${accountUidBackfills.length} fiche(s) : accountUid ← userId`);
    }
    if (report.noLinkedAdmin) {
      console.log("  ⚠️ aucun admin lié à un compte : ce club ne sera plus administrable");
      totals.clubsWithoutLinkedAdmin += 1;
    }
    for (const uid of report.adminIdsWithoutMember) {
      console.log(`  ⚠️ adminIds contient ${uid} sans fiche membre (retiré de l'index)`);
    }
    for (const memberId of report.unlinkedAdminMemberIds) {
      console.log(`  ℹ️ fiche admin non liée ${memberId} (admin à la liaison du compte)`);
    }
    for (const memberId of report.coachesWithoutTeam) {
      console.log(
        `  ⚠️ coach sans équipe ${memberId} : à rattacher à une équipe (sinon ni événements ni annonces)`,
      );
    }
    for (const doc of orphanRoleInvites) {
      console.log(
        `  ⚠️ invitation ${doc.id} (${doc.get("role")}) sans fiche : la personne arrivera sans droits`,
      );
    }
    totals.coachesWithoutTeam += report.coachesWithoutTeam.length;
    totals.invitationsWithRole += orphanRoleInvites.length;
    totals.membersPatched += plan.memberPatches.length;
    totals.accountUidBackfilled += accountUidBackfills.length;
    if (plan.adminIds !== null) totals.adminIndexesRewritten += 1;

    if (!options.apply) continue;
    const membersCol = club.ref.collection("members");
    await commitUpdates(firestore, [
      ...plan.memberPatches.map((patch) => [
        membersCol.doc(patch.memberId),
        { permissions: patch.permissions, coachTeamIds: patch.coachTeamIds },
      ]),
      ...accountUidBackfills.map((doc) => [
        doc.ref,
        { accountUid: String(doc.get("userId")).trim() },
      ]),
    ]);
    if (plan.adminIds !== null) {
      await club.ref.update({ adminIds: plan.adminIds });
    }
  }

  // `users.memberClubIds` devient le seul index des clubs : écarts avec
  // l'ancien `clubMemberships` (rapport seulement, à vérifier avant
  // `--drop-legacy`).
  if (!options.clubId) {
    const usersSnap = await firestore.collection("users").get();
    for (const doc of usersSnap.docs) {
      const gap = migration.clubIndexGap(
        doc.get("clubMemberships"),
        doc.get("memberClubIds"),
      );
      if (gap.missing.length === 0 && gap.extra.length === 0) continue;
      totals.usersWithClubIndexGap += 1;
      console.log(
        `  ⚠️ users/${doc.id} : clubMemberships sans memberClubIds [${gap.missing.join(", ")}], memberClubIds seuls [${gap.extra.join(", ")}]`,
      );
    }
  }
  return totals;
}

/** Phase `--drop-legacy` : supprime les anciens champs de rôle et index v1. */
async function dropLegacyDatabase({ firestore, FieldValue, options }) {
  const totals = { members: 0, invitations: 0, clubs: 0, users: 0, joinRequests: 0 };
  const LEGACY_MEMBER_FIELDS = ["role", "coachInfo", "userId", "memberId"];

  for (const club of await clubsOf(firestore, options)) {
    const [membersSnap, invitationsSnap] = await Promise.all([
      club.ref.collection("members").get(),
      club.ref.collection("invitations").get(),
    ]);
    const unmigrated = membersSnap.docs.filter(
      (doc) => !Array.isArray(doc.get("permissions")),
    );
    if (unmigrated.length > 0) {
      fail(
        `Club ${club.id} : ${unmigrated.length} fiche(s) sans permissions. Lance d'abord la phase additive.`,
      );
    }
    const unlinkedUserIds = membersSnap.docs.filter(
      (doc) =>
        String(doc.get("userId") ?? "").trim() &&
        !String(doc.get("accountUid") ?? "").trim(),
    );
    if (unlinkedUserIds.length > 0) {
      fail(
        `Club ${club.id} : ${unlinkedUserIds.length} fiche(s) avec userId sans accountUid. Lance d'abord la phase additive.`,
      );
    }
    const memberUpdates = membersSnap.docs
      .filter((doc) => LEGACY_MEMBER_FIELDS.some((field) => doc.get(field) !== undefined))
      .map((doc) => [
        doc.ref,
        Object.fromEntries(LEGACY_MEMBER_FIELDS.map((field) => [field, FieldValue.delete()])),
      ]);
    const invitationUpdates = invitationsSnap.docs
      .filter((doc) => doc.get("role") !== undefined)
      .map((doc) => [doc.ref, { role: FieldValue.delete() }]);
    const hasLegacyFlag =
      club.get("coachPermissions")?.canViewFees !== undefined;

    totals.members += memberUpdates.length;
    totals.invitations += invitationUpdates.length;
    if (hasLegacyFlag) totals.clubs += 1;
    if (!options.apply) continue;

    await commitUpdates(firestore, [...memberUpdates, ...invitationUpdates]);
    if (hasLegacyFlag) {
      await club.ref.update({ "coachPermissions.canViewFees": FieldValue.delete() });
    }
  }

  // `users.clubMemberships` (ancien index, remplacé par `memberClubIds`) et
  // demandes de rôle (flux supprimé). Parcourus en entier : pas de filtre
  // par club.
  if (!options.clubId) {
    const usersSnap = await firestore.collection("users").get();
    const userUpdates = usersSnap.docs
      .filter((doc) => doc.get("clubMemberships") !== undefined)
      .map((doc) => [doc.ref, { clubMemberships: FieldValue.delete() }]);
    totals.users = userUpdates.length;
    const joinRequestsSnap = await firestore.collection("join_requests").get();
    totals.joinRequests = joinRequestsSnap.size;
    if (options.apply) {
      await commitUpdates(firestore, userUpdates);
      for (let start = 0; start < joinRequestsSnap.docs.length; start += BATCH_SIZE) {
        const batch = firestore.batch();
        for (const doc of joinRequestsSnap.docs.slice(start, start + BATCH_SIZE)) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
    }
  }
  return totals;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { admin, getFirestore, FieldValue, migration } = loadModules();
  const app = initAdmin(admin, resolveCredentials());
  const mode = options.apply ? "APPLY" : "DRY-RUN";
  const phase = options.dropLegacy ? "suppression des champs de rôle" : "rôles → droits";

  for (const databaseId of options.databases) {
    console.log(`\n=== ${databaseId} — ${phase} (${mode}) ===`);
    const firestore = getFirestore(app, databaseId);
    const totals = options.dropLegacy
      ? await dropLegacyDatabase({ firestore, FieldValue, options })
      : await migrateDatabase({ firestore, migration, options });
    console.log(`\n${databaseId} : ${JSON.stringify(totals)}`);
    if (!options.dropLegacy && totals.clubsWithoutLinkedAdmin > 0) {
      console.log(
        "⚠️ Des clubs n'ont aucun admin lié à un compte : à traiter avant la bascule.",
      );
    }
  }
  if (!options.apply) console.log("\nDry-run : rien n'a été écrit (--apply pour écrire).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
