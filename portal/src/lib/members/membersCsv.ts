import type { MemberRow } from "./membersView";
import { MemberRoles } from "@/lib/firebase/constants";

/** Ligne d’import CSV normalisée. */
export type MemberImportRow = {
  lineNumber: number;
  firstName: string;
  lastName: string;
  role: typeof MemberRoles.player | typeof MemberRoles.coach;
  email: string;
  license: string;
  teamName: string;
  /** Erreur de validation, si présente. */
  error: string | null;
  /** Doublon approximatif dans le club (même prénom+nom). */
  duplicate: boolean;
};

/** Rapport d’exécution d’import. */
export type MemberImportReport = {
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
  /** Membres créés avec e-mail (éligibles à l’envoi Brevo). */
  inviteableMemberIds: string[];
  /** E-mails d’invitation effectivement envoyés via Brevo. */
  emailsSent: number;
};

const CSV_HEADERS = [
  "firstName",
  "lastName",
  "role",
  "email",
  "license",
  "teams",
  "registered",
  "inviteCode",
  "feeStatus",
] as const;

const HEADER_ALIASES: Record<string, string> = {
  firstname: "firstName",
  prenom: "firstName",
  prénom: "firstName",
  lastname: "lastName",
  nom: "lastName",
  role: "role",
  rôle: "role",
  email: "email",
  mail: "email",
  license: "license",
  licence: "license",
  team: "team",
  teams: "team",
  equipe: "team",
  équipe: "team",
};

/** Échappe une cellule CSV. */
function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Parse une ligne CSV (virgules, guillemets). */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === "," || char === ";") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

/** Normalise un en-tête CSV vers une clé canonique. */
function normalizeHeader(raw: string): string | null {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
  return HEADER_ALIASES[key] ?? null;
}

/** Normalise un rôle importé. */
function normalizeImportRole(
  raw: string,
): typeof MemberRoles.player | typeof MemberRoles.coach | null {
  const value = raw.trim().toLowerCase();
  if (
    value === MemberRoles.player ||
    value === "joueur" ||
    value === "j" ||
    value === ""
  ) {
    return MemberRoles.player;
  }
  if (
    value === MemberRoles.coach ||
    value === "coach" ||
    value === "entraîneur" ||
    value === "entraineur" ||
    value === "c"
  ) {
    return MemberRoles.coach;
  }
  return null;
}

/** Contenu modèle CSV téléchargeable. */
export function membersCsvTemplate(): string {
  return [
    "firstName,lastName,role,email,license,team",
    "Alice,Dupont,player,,LIC-001,U13",
    "Bob,Martin,coach,,,",
  ].join("\r\n");
}

/** Exporte les membres en CSV (UTF-8 BOM pour Excel). */
export function exportMembersToCsv(rows: MemberRow[]): string {
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((row) =>
      [
        row.firstName,
        row.lastName,
        row.role,
        row.email ?? "",
        row.license,
        row.teamNames.join(" | "),
        row.hasLinkedAccount ? "oui" : "non",
        row.pendingInviteCode ?? "",
        row.feeStatus ?? "",
      ]
        .map((cell) => escapeCsvCell(cell))
        .join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

/** Déclenche le téléchargement d’un fichier texte côté navigateur. */
export function downloadTextFile(params: {
  filename: string;
  content: string;
  mimeType?: string;
}): void {
  const blob = new Blob([params.content], {
    type: params.mimeType ?? "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = params.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse un CSV membres et produit des lignes validées.
 * `existingMembers` sert à détecter les doublons prénom+nom.
 */
export function parseMembersCsv(
  content: string,
  existingMembers: Array<{ firstName: string; lastName: string }>,
): MemberImportRow[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const headerCells = parseCsvLine(lines[0]!);
  const columnIndex = new Map<string, number>();
  headerCells.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    if (normalized) columnIndex.set(normalized, index);
  });

  const hasMappedHeaders =
    columnIndex.has("firstName") || columnIndex.has("lastName");
  const dataLines = hasMappedHeaders ? lines.slice(1) : lines;
  const fallbackIndex = hasMappedHeaders
    ? columnIndex
    : new Map([
        ["firstName", 0],
        ["lastName", 1],
        ["role", 2],
        ["email", 3],
        ["license", 4],
        ["team", 5],
      ]);

  const existingKeys = new Set(
    existingMembers.map(
      (member) =>
        `${member.firstName.trim().toLowerCase()}|${member.lastName.trim().toLowerCase()}`,
    ),
  );

  return dataLines.map((line, offset) => {
    const lineNumber = hasMappedHeaders ? offset + 2 : offset + 1;
    const cells = parseCsvLine(line);
    const cell = (key: string) => {
      const index = fallbackIndex.get(key);
      if (index == null) return "";
      return String(cells[index] ?? "").trim();
    };

    const firstName = cell("firstName");
    const lastName = cell("lastName");
    const roleRaw = cell("role");
    const role = normalizeImportRole(roleRaw);
    const email = cell("email");
    const license = cell("license");
    const teamName = cell("team");

    let error: string | null = null;
    if (!firstName || !lastName) {
      error = "Prénom et nom obligatoires.";
    } else if (!role) {
      error = `Rôle invalide (« ${roleRaw} »). Utilisez player ou coach.`;
    }

    const duplicateKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
    const duplicate = Boolean(firstName && lastName && existingKeys.has(duplicateKey));

    return {
      lineNumber,
      firstName,
      lastName,
      role: role ?? MemberRoles.player,
      email,
      license,
      teamName,
      error,
      duplicate,
    };
  });
}
