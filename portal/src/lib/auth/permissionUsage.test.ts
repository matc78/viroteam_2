import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou « droits purs » : seule `members/{uid}.permissions` fait foi, lue
 * via `@/lib/auth/permissions` (ClubAccess) et `useBureauCapabilities`. Plus
 * de rôle club comparé ; l’index `users.memberClubIds` ne porte que des ids
 * de club. Plus de modèles de rôle (`PERMISSION_TEMPLATES`) ni de demande de
 * rôle (`join_requests`).
 */

const SRC_DIR = fileURLToPath(new URL("../..", import.meta.url));
const SOURCE_EXTENSIONS = [".ts", ".tsx"];

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

const PERMISSIONS_FILE = join("lib", "auth", "permissions.ts");

const RULES: Rule[] = [
  {
    label: "MemberRoles supprimé (badges : derivedBadges ; droits : ClubAccess)",
    pattern: /\bMemberRoles\b/g,
  },
  {
    label: "rôle du club actif supprimé (utiliser useBureauCapabilities)",
    pattern: /\b(activeClubRole|isActiveClub(Admin|Coach|Player)|membershipRoleForClub)\b/g,
  },
  {
    // Générique : tout `x.role ===`. Seules exceptions, nommées : la place
    // dans un effectif (`params.role` : `TeamRosterRole` joueur / coach) et
    // la colonne `role` de l’import CSV (`action.role`, `row.role`).
    label: "comparaison d’un rôle (droits : can() ; badges : derivedBadges)",
    pattern: /(?<!\b(?:params|action|row))\??\.role\s*[!=]==/g,
  },
  {
    label: "adminIds n’est qu’un index d’audience, jamais une autorisation",
    pattern: /\badminIds\??\.includes\(/g,
  },
  {
    label: "champ role supprimé des fiches (droits : permissions)",
    pattern: /\bFields\.role\b/g,
  },
  {
    label: "ancienne callable setMemberRole (utiliser setMemberPermissions)",
    pattern: /\b(setMemberRole|updateMemberRole)\b/g,
  },
  {
    label: "modèles de rôle supprimés (droits purs : bascule admin, fonctions, droits)",
    pattern: /\b(PERMISSION_TEMPLATES|PermissionTemplate)\b/g,
  },
  {
    label: "ancien index users.clubMemberships (utiliser memberClubIds)",
    pattern: /\bclubMemberships\b/g,
  },
  {
    label: "demande de rôle supprimée (join_requests / resolveJoinRequest)",
    pattern: /\b(join_requests|joinRequests|resolveJoinRequest)\b/g,
  },
  {
    label: "lecture brute des droits hors du point d’entrée (can(), isAdminMember())",
    pattern: /\.permissions\.includes\(/g,
    allowedFiles: [PERMISSIONS_FILE],
  },
];

function violationsIn(content: string, file: string): string[] {
  const found: string[] = [];
  for (const rule of RULES) {
    if (rule.allowedFiles?.includes(file)) continue;
    for (const match of content.matchAll(rule.pattern)) {
      const line = content.slice(0, match.index ?? 0).split("\n").length;
      found.push(`${file}:${line} — ${rule.label}`);
    }
  }
  return found;
}

describe("aucune vérification par rôle dans le portail", () => {
  it("sources sans rôle club", () => {
    const violations = listSourceFiles(SRC_DIR).flatMap((path) =>
      violationsIn(readFileSync(path, "utf8"), relative(SRC_DIR, path)),
    );
    expect(violations).toEqual([]);
  });

  it("le garde-fou détecte les vérifications par rôle", () => {
    const samples = [
      "if (role === MemberRoles.admin) {}",
      "const { activeClubRole } = useAuth();",
      'if (member.role === "admin") return;',
      'if (club.role !== "coach") return;',
      'if (tile?.role === "admin") return;',
      "club.adminIds.includes(uid)",
      "data[Fields.role]",
      "await updateMemberRole({ clubId });",
      'access.permissions.includes("manageFees")',
      'member.permissions.includes("admin")',
      "const t = PERMISSION_TEMPLATES.coach;",
      "profile.clubMemberships.length",
      'httpsCallable(functions, "resolveJoinRequest")',
    ];
    for (const sample of samples) {
      expect(violationsIn(sample, "exemple.ts"), sample).toHaveLength(1);
    }
    expect(violationsIn('can(access, "manageFees")', "exemple.ts")).toEqual([]);
    // Place dans un effectif / colonne d’import : pas un rôle club.
    expect(violationsIn('params.role === "coach"', "exemple.ts")).toEqual([]);
    expect(violationsIn('action.role === "admin"', "exemple.ts")).toEqual([]);
  });
});
