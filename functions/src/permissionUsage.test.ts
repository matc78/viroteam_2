/**
 * Garde-fou « droits purs » : seule la liste `members/{uid}.permissions`
 * fait foi, lue via `permissions.ts` / `permissionsCatalog.ts`. Plus de champ
 * `role` qui autorise, et `clubs.adminIds` n'est qu'un index d'audience.
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
    // `chat/sync.ts` compare le badge d'un profil de conversation
    // (`participantProfiles[uid].role`), pas un rôle de fiche membre.
    label: "comparaison d'un champ role (utiliser loadClubAccess / can())",
    pattern: /\.role\s*[!=]==/g,
    allowedFiles: ["sync.ts"],
  },
  {
    label: "requête sur le champ role (les droits vivent dans permissions)",
    pattern: /where\(\s*["']role["']/g,
  },
  {
    label: "adminIds utilisé pour autoriser (index d'audience seulement)",
    pattern: /adminIds\.includes\(/g,
  },
  {
    // `deleteAccount.ts` retrouve les clubs à nettoyer (pas une autorisation).
    label: "requête sur adminIds (utiliser loadClubAccess)",
    pattern: /where\(\s*["']adminIds["']/g,
    allowedFiles: ["deleteAccount.ts"],
  },
  {
    label: "index adminIds calculé hors de adminIdsUpdate",
    pattern: /adminIdsAfterPermissionsChange\(/g,
    allowedFiles: ["permissionsCatalog.ts"],
  },
  {
    label: "ancienne garde par rôle (utiliser assertPermission)",
    pattern: /\b(assertClubAdmin|isClubAdmin|assertEventCoachOrAdmin)\b/g,
  },
  {
    label: "lecture de permissions hors du point d'entrée unique",
    pattern: /permissions\.includes\(/g,
    allowedFiles: ["permissionsCatalog.ts"],
  },
];

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function violationsIn(content: string, file: string): string[] {
  const found: string[] = [];
  for (const rule of RULES) {
    if (rule.allowedFiles?.includes(path.basename(file))) continue;
    for (const match of content.matchAll(rule.pattern)) {
      found.push(`${file}:${lineOf(content, match.index ?? 0)} — ${rule.label}`);
    }
  }
  return found;
}

test("aucune vérification par rôle dans les sources Functions", () => {
  const violations = sourceFiles(SRC_DIR).flatMap((file) =>
    violationsIn(readFileSync(file, "utf8"), path.relative(SRC_DIR, file)),
  );
  assert.deepEqual(violations, []);
});

test("le garde-fou détecte les vérifications par rôle", () => {
  const offending = [
    'if (member.role === "admin") return;',
    'col.where("role", "==", "admin")',
    "if (adminIds.includes(uid)) return club;",
    'col.where("adminIds", "array-contains", uid)',
    "const next = adminIdsAfterPermissionsChange({ adminIds });",
    "await assertClubAdmin(clubId, uid);",
    'if (member.permissions.includes("admin")) return;',
  ];
  for (const line of offending) {
    assert.equal(violationsIn(line, "exemple.ts").length, 1, line);
  }
  assert.deepEqual(
    violationsIn('const access = await loadClubAccess(clubId, uid);', "exemple.ts"),
    [],
  );
});
