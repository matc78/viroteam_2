#!/usr/bin/env node
/**
 * Après l'upload d'une build iOS : renseigne les notes de version via l'API
 * App Store Connect (clé API, mêmes secrets que release-ios.yml).
 *
 * - Toujours : attend que la build soit traitée, puis écrit « What to Test »
 *   (notes TestFlight) pour la langue fr-FR.
 * - Avec --app-store : prépare la version App Store X.Y.Z (création si absente),
 *   écrit ses « Nouveautés » et y attache la build. Pas d'envoi en review :
 *   la soumission reste manuelle, comme le brouillon production Play.
 *
 * Usage (depuis la racine du repo) :
 *   node tool/app_store_connect_release.mjs --build-number=142 [--app-store]
 *
 * Env : ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_P8 (contenu du .p8), BUNDLE_ID.
 * Version et notes : pubspec + distribution/release-notes (tool/release_notes.mjs).
 */

import crypto from "node:crypto";
import { buildReleaseNotes, RELEASE_NOTES_LOCALE } from "./release_notes.mjs";

const API_BASE = "https://api.appstoreconnect.apple.com";
const BUILD_POLL_INTERVAL_MS = 30_000;
const BUILD_WAIT_TIMEOUT_MS = 60 * 60_000;

/** États où une version App Store accepte encore des modifications. */
const EDITABLE_VERSION_STATES = new Set([
  "PREPARE_FOR_SUBMISSION",
  "DEVELOPER_REJECTED",
  "REJECTED",
  "METADATA_REJECTED",
  "INVALID_BINARY",
]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Variable d'environnement ${name} manquante.`);
  return value.trim();
}

function readArg(argv, name) {
  const prefix = `--${name}=`;
  const arg = argv.find((candidate) => candidate.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

/**
 * Jeton JWT ES256 pour l'API App Store Connect (valide 20 min, le maximum).
 *
 * @returns {string} jeton à passer en `Authorization: Bearer`
 */
function createAuthToken(keyId, issuerId, privateKeyPem) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({ iss: issuerId, iat: nowSeconds, exp: nowSeconds + 20 * 60, aud: "appstoreconnect-v1" }),
  );
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${payload}`), {
    key: privateKeyPem,
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${payload}.${base64Url(signature)}`;
}

/**
 * Client minimal de l'API App Store Connect (nouveau jeton à chaque appel :
 * l'attente du traitement de la build dépasse la durée de vie d'un jeton).
 */
function createApiClient({ keyId, issuerId, privateKeyPem }) {
  return async function callApi(method, apiPath, body) {
    const response = await fetch(`${API_BASE}${apiPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${createAuthToken(keyId, issuerId, privateKeyPem)}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 204) return null;
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const details = (json?.errors ?? []).map((error) => `${error.title} — ${error.detail}`).join(" | ");
      throw new Error(`${method} ${apiPath} → HTTP ${response.status}${details ? ` : ${details}` : ""}`);
    }
    return json;
  };
}

async function findApp(callApi, bundleId) {
  const json = await callApi("GET", `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=1`);
  const app = json.data[0];
  if (!app) throw new Error(`Aucune app App Store Connect pour le bundle ${bundleId}.`);
  return app;
}

/** Attend que la build (version + numéro) soit traitée par Apple. */
async function waitForProcessedBuild(callApi, appId, version, buildNumber) {
  const query =
    `/v1/builds?filter[app]=${appId}&filter[version]=${encodeURIComponent(buildNumber)}` +
    `&filter[preReleaseVersion.version]=${encodeURIComponent(version)}` +
    "&fields[builds]=version,processingState&limit=1";
  const deadline = Date.now() + BUILD_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const build = (await callApi("GET", query)).data[0];
    const state = build?.attributes.processingState ?? "PAS ENCORE VISIBLE";
    if (state === "VALID") return build;
    if (state === "FAILED" || state === "INVALID") {
      throw new Error(`Build ${version} (${buildNumber}) rejetée au traitement : ${state}.`);
    }
    console.log(`… build ${version} (${buildNumber}) : ${state}`);
    await new Promise((resolve) => setTimeout(resolve, BUILD_POLL_INTERVAL_MS));
  }
  throw new Error(`Build ${version} (${buildNumber}) toujours pas traitée après 60 min.`);
}

async function setTestFlightNotes(callApi, buildId, notes) {
  const existing = await callApi("GET", `/v1/builds/${buildId}/betaBuildLocalizations?limit=50`);
  const localization = existing.data.find((item) => item.attributes.locale === RELEASE_NOTES_LOCALE);
  if (localization) {
    await callApi("PATCH", `/v1/betaBuildLocalizations/${localization.id}`, {
      data: { type: "betaBuildLocalizations", id: localization.id, attributes: { whatsNew: notes } },
    });
  } else {
    await callApi("POST", "/v1/betaBuildLocalizations", {
      data: {
        type: "betaBuildLocalizations",
        attributes: { locale: RELEASE_NOTES_LOCALE, whatsNew: notes },
        relationships: { build: { data: { type: "builds", id: buildId } } },
      },
    });
  }
}

function versionState(appStoreVersion) {
  return appStoreVersion.attributes.appVersionState ?? appStoreVersion.attributes.appStoreState;
}

/**
 * Retourne la version App Store X.Y.Z modifiable. Apple n'admet qu'une version
 * en préparation à la fois : une version en cours non soumise (ex. 2.2.13
 * jamais envoyée) est renommée en X.Y.Z, sinon une nouvelle est créée.
 */
async function findOrCreateAppStoreVersion(callApi, appId, version) {
  const existing = await callApi(
    "GET",
    `/v1/apps/${appId}/appStoreVersions?filter[versionString]=${encodeURIComponent(version)}&filter[platform]=IOS&limit=1`,
  );
  const current = existing.data[0];
  if (current) {
    if (!EDITABLE_VERSION_STATES.has(versionState(current))) {
      throw new Error(`La version App Store ${version} n'est plus modifiable (état ${versionState(current)}).`);
    }
    return current;
  }

  const recent = await callApi("GET", `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=20`);
  const pending = recent.data.find((item) => EDITABLE_VERSION_STATES.has(versionState(item)));
  if (pending) {
    console.log(`Version App Store ${pending.attributes.versionString} en préparation → renommée en ${version}`);
    const renamed = await callApi("PATCH", `/v1/appStoreVersions/${pending.id}`, {
      data: { type: "appStoreVersions", id: pending.id, attributes: { versionString: version } },
    });
    return renamed.data;
  }

  const created = await callApi("POST", "/v1/appStoreVersions", {
    data: {
      type: "appStoreVersions",
      attributes: { platform: "IOS", versionString: version },
      relationships: { app: { data: { type: "apps", id: appId } } },
    },
  });
  return created.data;
}

async function setAppStoreNotes(callApi, appStoreVersionId, notes) {
  const localizations = await callApi(
    "GET",
    `/v1/appStoreVersions/${appStoreVersionId}/appStoreVersionLocalizations?limit=50`,
  );
  const localization = localizations.data.find((item) => item.attributes.locale === RELEASE_NOTES_LOCALE);
  if (!localization) {
    const locales = localizations.data.map((item) => item.attributes.locale).join(", ") || "aucune";
    throw new Error(`Pas de fiche ${RELEASE_NOTES_LOCALE} sur la version App Store (langues : ${locales}).`);
  }
  await callApi("PATCH", `/v1/appStoreVersionLocalizations/${localization.id}`, {
    data: { type: "appStoreVersionLocalizations", id: localization.id, attributes: { whatsNew: notes } },
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const buildNumber = readArg(argv, "build-number");
  if (!buildNumber) throw new Error("--build-number=<N> requis.");
  const prepareAppStore = argv.includes("--app-store");

  const { version, text: notes } = buildReleaseNotes(process.cwd());
  const callApi = createApiClient({
    keyId: requireEnv("ASC_KEY_ID"),
    issuerId: requireEnv("ASC_ISSUER_ID"),
    privateKeyPem: requireEnv("ASC_API_KEY_P8"),
  });

  const app = await findApp(callApi, requireEnv("BUNDLE_ID"));
  const build = await waitForProcessedBuild(callApi, app.id, version, buildNumber);

  await setTestFlightNotes(callApi, build.id, notes);
  console.log(`✅ TestFlight ${version} (${buildNumber}) : notes « What to Test » renseignées`);

  if (!prepareAppStore) return;

  const appStoreVersion = await findOrCreateAppStoreVersion(callApi, app.id, version);
  await setAppStoreNotes(callApi, appStoreVersion.id, notes);
  await callApi("PATCH", `/v1/appStoreVersions/${appStoreVersion.id}/relationships/build`, {
    data: { type: "builds", id: build.id },
  });
  console.log(
    `✅ App Store ${version} : Nouveautés renseignées, build ${buildNumber} attachée — ` +
      "à soumettre pour vérification depuis App Store Connect",
  );
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
