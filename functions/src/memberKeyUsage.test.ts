/**
 * Garde-fou « une seule clé membre » : une fiche liée vit à `members/{uid}`
 * (voir `memberRekeyPlan.ts`) et l'index `member_accounts` n'existe plus.
 * Scanne les sources TypeScript des Functions (hors tests).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SRC_DIR = path.join(__dirname, "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [full] : [];
  });
}

type Rule = { label: string; pattern: RegExp; allowedFiles?: string[] };

const RULES: Rule[] = [
  {
    label: "fiche membre à id aléatoire (une fiche de compte vit à members/{uid})",
    pattern: /collection\(\s*["']members["']\s*\)\s*\.doc\(\s*\)/g,
  },
  {
    // Seul le re-keying supprime encore `member_accounts/{uid}` (restes).
    label: "index member_accounts (supprimé) hors memberRekey.ts",
    pattern: /member_accounts/g,
    allowedFiles: ["memberRekey.ts"],
  },
  {
    label: "repli accountUid ?? memberId (deux clés pour une personne)",
    pattern: /accountUid\s*\?\?\s*[\w.]*\b(memberId|id)\b/g,
  },
  {
    label: "marqueur de transition COMPAT-REKEY (nettoyage fait)",
    pattern: /COMPAT-REKEY/g,
  },
  {
    label: "résolution d'un ancien memberId (resolveCurrentMemberId)",
    pattern: /resolveCurrentMemberId/g,
  },
];

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

test("aucune double clé membre dans les sources Functions", () => {
  const violations: string[] = [];
  for (const file of sourceFiles(SRC_DIR)) {
    const content = readFileSync(file, "utf8");
    for (const rule of RULES) {
      if (rule.allowedFiles?.includes(path.basename(file))) continue;
      for (const match of content.matchAll(rule.pattern)) {
        const line = lineOf(content, match.index ?? 0);
        violations.push(`${path.relative(SRC_DIR, file)}:${line} — ${rule.label}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});
