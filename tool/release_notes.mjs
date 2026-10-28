#!/usr/bin/env node
/**
 * Notes de version des stores (« Nouveautés » Play, « What to Test » TestFlight,
 * « Nouveautés » App Store), lues dans distribution/release-notes/<X.Y.Z>.txt.
 *
 * Le texte publié = « Version X.Y.Z » + le contenu du fichier : le testeur voit
 * ainsi vers quelle version il passe. Limite Play : 500 caractères par langue,
 * en-tête compris (au-delà l'API refuse la release).
 *
 * Usage :
 *   node tool/release_notes.mjs                  # vérifie les notes de la version du pubspec
 *   node tool/release_notes.mjs --out=whatsnew   # écrit whatsnew/whatsnew-fr-FR (format Play)
 *
 * Exit 0 si OK, 1 sinon.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Langue des notes (fiche Play et App Store en français). */
export const RELEASE_NOTES_LOCALE = "fr-FR";

/** Limite Play Console, en caractères Unicode, en-tête compris. */
export const PLAY_RELEASE_NOTES_MAX_LENGTH = 500;

/**
 * Lit la version du pubspec et construit le texte des notes publiées.
 *
 * @param {string} root racine du repo
 * @returns {{ version: string, text: string }} version X.Y.Z et texte final
 * @throws {Error} si le pubspec, le fichier de notes ou sa longueur sont invalides
 */
export function buildReleaseNotes(root) {
  const pubspec = fs.readFileSync(path.join(root, "pubspec.yaml"), "utf8");
  const versionMatch = pubspec.match(/^version:\s*(\d+\.\d+\.\d+)\+\d+\s*$/m);
  if (!versionMatch) {
    throw new Error("pubspec.yaml : version invalide (attendu `version: X.Y.Z+N`).");
  }
  const version = versionMatch[1];

  const notesPath = path.join(root, "distribution", "release-notes", `${version}.txt`);
  if (!fs.existsSync(notesPath)) {
    throw new Error(
      `Notes de version absentes : ${path.relative(root, notesPath)}. ` +
        "Écris les nouveautés visibles par les utilisateurs avant de taguer.",
    );
  }

  const body = fs.readFileSync(notesPath, "utf8").replace(/\r\n/g, "\n").trim();
  if (!body) {
    throw new Error(`${path.relative(root, notesPath)} est vide.`);
  }
  if (body.includes("�")) {
    throw new Error(`${path.relative(root, notesPath)} contient U+FFFD (encodage cassé).`);
  }

  const text = `Version ${version}\n${body}`;
  const length = [...text].length;
  if (length > PLAY_RELEASE_NOTES_MAX_LENGTH) {
    throw new Error(
      `Notes ${version} trop longues : ${length} caractères, en-tête compris ` +
        `(max ${PLAY_RELEASE_NOTES_MAX_LENGTH} sur Google Play).`,
    );
  }
  return { version, text };
}

function readOutArg(argv) {
  for (const arg of argv) {
    if (arg.startsWith("--out=")) return arg.slice("--out=".length);
  }
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  let notes;
  try {
    notes = buildReleaseNotes(root);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  const outDir = readOutArg(process.argv.slice(2));
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `whatsnew-${RELEASE_NOTES_LOCALE}`), notes.text);
  }
  console.log(
    `✅ Notes de version ${notes.version} OK (${[...notes.text].length}/${PLAY_RELEASE_NOTES_MAX_LENGTH} caractères)`,
  );
  console.log(notes.text);
}
