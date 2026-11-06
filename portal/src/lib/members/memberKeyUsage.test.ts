import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou « une seule clé membre » : une fiche liée vit à `members/{uid}`,
 * son id est la seule clé (rosters, audiences, RSVP, cotisations, adminIds…).
 * Plus d’index `member_accounts`, plus de résolveur uid ↔ memberId, et le
 * chemin de la fiche du compte connecté ne se construit que via
 * `src/lib/firebase/memberRefs.ts`.
 */

const SRC_DIR = fileURLToPath(new URL("../..", import.meta.url));
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const MEMBER_REFS_FILE = join("lib", "firebase", "memberRefs.ts");

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    const isSource = SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext));
    const isTest = /\.test\.tsx?$/.test(entry.name);
    return isSource && !isTest ? [path] : [];
  });
}

type Rule = { label: string; pattern: RegExp; allowedFiles?: string[] };

/** Identifiant désignant le compte connecté (uid Auth). */
const CURRENT_UID = String.raw`[\w.?]*\b(?:uid|authUid|currentUid|viewerUid|founderUid)\b`;

const RULES: Rule[] = [
  {
    label: "index member_accounts supprimé (fiche liée = members/{uid})",
    pattern: /member_accounts|memberAccounts/g,
  },
  {
    label: "résolveur uid ↔ memberId supprimé",
    pattern: /\b(?:getLinkedMemberId|rosterIdFromMemberData|memberMatchIds)\b/g,
  },
  {
    label: "repli accountUid ?? … (deux clés pour une personne)",
    pattern: /accountUid\s*\?\?/g,
  },
  {
    label: "chemin members/{uid} hors memberRefs.ts (utiliser ownMemberRef / getOwnMemberId)",
    pattern: new RegExp(
      [
        String.raw`Collections\.members\s*,\s*${CURRENT_UID}`,
        String.raw`membersCol\([^)]*\)\s*,\s*${CURRENT_UID}`,
        String.raw`members/\$\{${CURRENT_UID}\}`,
      ].join("|"),
      "g",
    ),
    allowedFiles: [MEMBER_REFS_FILE],
  },
];

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

describe("une seule clé membre", () => {
  it("aucune double clé membre dans les sources du portail", () => {
    const violations: string[] = [];
    for (const path of listSourceFiles(SRC_DIR)) {
      const file = relative(SRC_DIR, path);
      const content = readFileSync(path, "utf8");
      for (const rule of RULES) {
        if (rule.allowedFiles?.includes(file)) continue;
        for (const match of content.matchAll(rule.pattern)) {
          violations.push(
            `${file}:${lineOf(content, match.index ?? 0)} — ${rule.label}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("le garde-fou détecte bien un chemin members/{uid} construit à la main", () => {
    const rule = RULES[3]!;
    const samples = [
      "doc(db, Collections.clubs, clubId, Collections.members, params.uid)",
      "doc(membersCol(clubId), user.uid)",
      "`clubs/${clubId}/members/${uid}`",
    ];
    for (const sample of samples) {
      expect(sample.match(rule.pattern), sample).not.toBeNull();
    }
    expect(
      "doc(membersCol(clubId), params.memberId)".match(rule.pattern),
    ).toBeNull();
  });
});
