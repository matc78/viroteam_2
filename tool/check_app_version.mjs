#!/usr/bin/env node
/**
 * Vérifie l’alignement version : pubspec.yaml ↔ ProjectConfig [↔ tag].
 *
 * Usage :
 *   node tool/check_app_version.mjs
 *   node tool/check_app_version.mjs --tag=v2.2.2
 *   node tool/check_app_version.mjs --tag=release-v2.2.2
 *
 * Exit 0 si OK, 1 sinon.
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pubspecPath = path.join(root, "pubspec.yaml");
const configPath = path.join(root, "lib", "config", "project_config.dart");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function readTagArg(argv) {
  for (const arg of argv) {
    if (arg.startsWith("--tag=")) return arg.slice("--tag=".length);
  }
  const fromEnv = process.env.TAG_VERSION;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return null;
}

/** Accepte v2.2.2 / release-v2.2.2 / refs/tags/v2.2.2 / 2.2.2 */
function normalizeTag(raw) {
  let value = raw.trim();
  if (value.startsWith("refs/tags/")) value = value.slice("refs/tags/".length);
  if (value.startsWith("release-v")) return value.slice("release-v".length);
  if (value.startsWith("v")) return value.slice(1);
  return value;
}

if (!fs.existsSync(pubspecPath)) {
  fail("pubspec.yaml introuvable (lance depuis la racine du repo).");
}
if (!fs.existsSync(configPath)) {
  fail("lib/config/project_config.dart introuvable.");
}

const pubspec = fs.readFileSync(pubspecPath, "utf8");
const pubspecMatch = pubspec.match(/^version:\s*(\d+\.\d+\.\d+)\+(\d+)\s*$/m);
if (!pubspecMatch) {
  fail("pubspec.yaml : version invalide (attendu `version: X.Y.Z+N`).");
}

const pubspecName = pubspecMatch[1];
const pubspecCode = pubspecMatch[2];

const configSource = fs.readFileSync(configPath, "utf8");
const nameMatch = configSource.match(
  /static const String appVersionName\s*=\s*'([^']+)'/,
);
const codeMatch = configSource.match(
  /static const int appVersionCode\s*=\s*(\d+)/,
);

if (!nameMatch || !codeMatch) {
  fail("Impossible de lire appVersionName / appVersionCode dans ProjectConfig.");
}

const configName = nameMatch[1];
const configCode = codeMatch[1];

let failed = false;

if (pubspecName !== configName) {
  console.error(
    `❌ Nom de version différent : pubspec=${pubspecName} vs ProjectConfig=${configName}`,
  );
  failed = true;
}

if (pubspecCode !== configCode) {
  console.error(
    `❌ Build number différent : pubspec=+${pubspecCode} vs ProjectConfig=${configCode}`,
  );
  failed = true;
}

const tagArg = readTagArg(process.argv.slice(2));
if (tagArg) {
  const normalizedTag = normalizeTag(tagArg);
  if (pubspecName !== normalizedTag) {
    console.error(
      `❌ Tag ≠ pubspec : tag=${normalizedTag} vs pubspec=${pubspecName}`,
    );
    console.error(
      "   Mets à jour pubspec.yaml + ProjectConfig.appVersionName avant de taguer.",
    );
    failed = true;
  }
}

if (failed) process.exit(1);

if (tagArg) {
  console.log(
    `✅ Version alignée : ${pubspecName}+${pubspecCode} (tag ${tagArg})`,
  );
} else {
  console.log(
    `✅ Version alignée : ${pubspecName}+${pubspecCode} (pubspec ↔ ProjectConfig)`,
  );
}
