import type { MemberRow } from "./membersView";
import { validateEmail } from "@/lib/auth/validateEmail";
import { MemberRoles } from "@/lib/firebase/constants";
import { teamCategoriesForSport } from "@/lib/teams/teamCategories";

/** Rôles acceptés à l’import CSV. */
export type ImportClubRole =
  | typeof MemberRoles.player
  | typeof MemberRoles.coach
  | typeof MemberRoles.admin;

/** Ligne d’import CSV normalisée. */
export type MemberImportRow = {
  lineNumber: number;
  firstName: string;
  lastName: string;
  role: ImportClubRole;
  email: string;
  license: string;
  teamName: string;
  category: string;
  /** Équipe ignorée car rôle admin (rattachement manuel). */
  teamIgnoredForAdmin: boolean;
  /** Erreur de validation ligne, si présente. */
  error: string | null;
  /** Membre club existant (même prénom+nom) — le CSV gagne à l’import. */
  existingMemberId: string | null;
};

/** Action prévue sur une équipe. */
export type MembersImportTeamAction = {
  name: string;
  category: string;
  existingTeamId: string | null;
  categoryWillUpdate: boolean;
};

/** Action prévue sur un membre. */
export type MembersImportMemberAction = {
  lineNumber: number;
  action: "create" | "update";
  existingMemberId: string | null;
  firstName: string;
  lastName: string;
  role: ImportClubRole;
  email: string;
  license: string;
  /** Nom d’équipe à rattacher (vide si admin ou sans équipe). */
  teamName: string;
  category: string;
  teamIgnoredForAdmin: boolean;
};

/** Plan d’import validé (ou bloqué). */
export type MembersImportPlan = {
  blockingErrors: string[];
  rows: MemberImportRow[];
  teamsToCreate: MembersImportTeamAction[];
  teamsToUpdate: MembersImportTeamAction[];
  memberActions: MembersImportMemberAction[];
  allowedCategories: string[];
  stats: {
    createMembers: number;
    updateMembers: number;
    createTeams: number;
    updateTeams: number;
    admins: number;
    withTeam: number;
  };
};

/** Rapport d’exécution d’import. */
export type MemberImportReport = {
  created: number;
  updated: number;
  teamsCreated: number;
  teamsUpdated: number;
  failed: number;
  /** Erreurs bloquantes (échec d’import / lignes non traitées). */
  errors: string[];
  /** Avertissements non bloquants (ex. e-mail déjà inscrit). */
  warnings: string[];
  /** Membres créés/mis à jour avec e-mail (éligibles à l’envoi Brevo). */
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
  category: "category",
  categorie: "category",
  catégorie: "category",
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

/** Clé de comparaison sans accents / casse. */
function normalizeCompareKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Normalise un rôle importé (player | coach | admin). */
function normalizeImportRole(raw: string): ImportClubRole | null {
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
  if (
    value === MemberRoles.admin ||
    value === "administrateur" ||
    value === "administratrice" ||
    value === "bureau" ||
    value === "a"
  ) {
    return MemberRoles.admin;
  }
  return null;
}

/**
 * Retrouve la catégorie canonique dans la liste autorisée (casse / accents).
 * Retourne null si absente.
 */
export function matchAllowedCategory(
  raw: string,
  allowedCategories: string[],
): string | null {
  const needle = normalizeCompareKey(raw);
  if (!needle) return null;
  return (
    allowedCategories.find(
      (category) => normalizeCompareKey(category) === needle,
    ) ?? null
  );
}

/** Contenu modèle CSV téléchargeable. */
export function membersCsvTemplate(params?: { categoryExample?: string }): string {
  const category = params?.categoryExample?.trim() || "U13";
  return [
    "firstName,lastName,role,email,license,team,category",
    `Alice,Dupont,player,alice@example.com,LIC-001,U13 A,${category}`,
    `Bob,Martin,coach,bob@example.com,,U13 A,${category}`,
    "Claire,Bureau,admin,claire@example.com,,,",
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
        row.teamLabels.join(" | "),
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

type ExistingMemberRef = {
  memberId: string;
  firstName: string;
  lastName: string;
  /** Rôle actuel dans le club (pour valider le dernier admin). */
  role?: string;
  /** UID compte lié, si présent. */
  accountUid?: string | null;
};

type ExistingTeamRef = {
  id: string;
  name: string;
  category: string;
};

/**
 * Vérifie qu’aucune ligne du plan ne retirerait le dernier administrateur du club.
 * Parcourt tout le fichier et signale toutes les lignes concernées d’un coup.
 */
function blockingErrorsForLastAdmin(params: {
  memberActions: MembersImportMemberAction[];
  existingMembers: ExistingMemberRef[];
  adminIds: string[];
}): string[] {
  const existingById = new Map(
    params.existingMembers.map((member) => [member.memberId, member]),
  );
  const nextAdminIds = new Set(
    params.adminIds.map((id) => id.trim()).filter(Boolean),
  );

  // Fallback : si adminIds est vide, s’appuyer sur les rôles membres.
  if (nextAdminIds.size === 0) {
    for (const member of params.existingMembers) {
      if (member.role !== MemberRoles.admin) continue;
      nextAdminIds.add(
        (member.accountUid ?? member.memberId).trim() || member.memberId,
      );
    }
  }

  const demotionLineNumbers: number[] = [];

  for (const action of params.memberActions) {
    if (!action.existingMemberId || action.action !== "update") continue;
    const existing = existingById.get(action.existingMemberId);
    if (!existing) continue;

    const wasAdmin = existing.role === MemberRoles.admin;
    const willBeAdmin = action.role === MemberRoles.admin;
    const adminKey =
      (existing.accountUid ?? existing.memberId).trim() || existing.memberId;

    if (wasAdmin && !willBeAdmin) {
      demotionLineNumbers.push(action.lineNumber);
      nextAdminIds.delete(adminKey);
      continue;
    }

    if (!wasAdmin && willBeAdmin && existing.accountUid?.trim()) {
      nextAdminIds.add(existing.accountUid.trim());
    }
  }

  if (demotionLineNumbers.length === 0 || nextAdminIds.size > 0) {
    return [];
  }

  return demotionLineNumbers.map(
    (lineNumber) =>
      `Ligne ${lineNumber} : Impossible de retirer le dernier administrateur. Corrigez le fichier puis réessayez.`,
  );
}

/**
 * Construit le plan d’import : validation stricte, équipes, créations / mises à jour.
 * Aucune écriture Firestore — à exécuter seulement si `blockingErrors` est vide.
 */
export function buildMembersImportPlan(params: {
  content: string;
  sport: string;
  existingMembers: ExistingMemberRef[];
  existingTeams: ExistingTeamRef[];
  /** UIDs admin du club (garde-fou dernier administrateur). */
  adminIds?: string[];
}): MembersImportPlan {
  const allowedCategories = teamCategoriesForSport(params.sport);
  const emptyStats = {
    createMembers: 0,
    updateMembers: 0,
    createTeams: 0,
    updateTeams: 0,
    admins: 0,
    withTeam: 0,
  };

  const lines = params.content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      blockingErrors: [],
      rows: [],
      teamsToCreate: [],
      teamsToUpdate: [],
      memberActions: [],
      allowedCategories,
      stats: emptyStats,
    };
  }

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
        ["category", 6],
      ]);

  const existingByKey = new Map<string, string>();
  const existingById = new Map(
    params.existingMembers.map((member) => [member.memberId, member]),
  );
  for (const member of params.existingMembers) {
    const key = `${normalizeCompareKey(member.firstName)}|${normalizeCompareKey(member.lastName)}`;
    if (!existingByKey.has(key)) {
      existingByKey.set(key, member.memberId);
    }
  }

  const teamsByName = new Map(
    params.existingTeams.map((team) => [
      normalizeCompareKey(team.name),
      team,
    ]),
  );

  const categoriesListLabel = allowedCategories.join(", ");
  const rows: MemberImportRow[] = [];
  const seenInCsv = new Map<string, number>();
  const seenEmailInCsv = new Map<string, number>();
  const teamCategoryInCsv = new Map<string, { category: string; lineNumber: number }>();
  const blockingErrors: string[] = [];
  const missingEmailLineNumbers: number[] = [];

  for (let offset = 0; offset < dataLines.length; offset += 1) {
    const line = dataLines[offset]!;
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
    // E-mail normalisé (trim + lowercase) : c’est l’adresse qui pourra accepter.
    const email = cell("email").toLowerCase();
    const license = cell("license");
    const teamNameRaw = cell("team");
    const categoryRaw = cell("category");

    let error: string | null = null;
    let teamName = teamNameRaw;
    let category = "";
    let teamIgnoredForAdmin = false;

    // E-mail obligatoire sauf pour un membre déjà inscrit (compte lié) : son
    // e-mail CSV est ignoré à l’import.
    const personKeyForEmail =
      firstName && lastName
        ? `${normalizeCompareKey(firstName)}|${normalizeCompareKey(lastName)}`
        : "";
    const existingForEmail = personKeyForEmail
      ? existingById.get(existingByKey.get(personKeyForEmail) ?? "")
      : undefined;
    const emailRequired = !existingForEmail?.accountUid?.trim();

    if (!firstName || !lastName) {
      error = "Prénom et nom obligatoires.";
    } else if (emailRequired && !email) {
      missingEmailLineNumbers.push(lineNumber);
      error =
        "E-mail obligatoire : seule l’adresse invitée pourra accepter l’invitation. Corrigez le fichier puis réessayez.";
    } else if (email && validateEmail(email)) {
      error = `E-mail invalide (« ${email} »). Utilisez le format prenom.nom@exemple.fr, puis réessayez.`;
    } else if (!role) {
      error = `Rôle invalide (« ${roleRaw || "vide"} »). Utilisez player, coach ou admin (ou joueur, entraîneur, administrateur). Corrigez le fichier puis réessayez.`;
    } else if (role === MemberRoles.admin && teamNameRaw) {
      teamIgnoredForAdmin = true;
      teamName = "";
      category = "";
    } else if (teamNameRaw) {
      if (!categoryRaw) {
        error = `Équipe « ${teamNameRaw} » : la colonne category est obligatoire. Valeurs acceptées pour ce club : ${categoriesListLabel}. Corrigez le fichier puis réessayez.`;
      } else {
        const matched = matchAllowedCategory(categoryRaw, allowedCategories);
        if (!matched) {
          error = `Catégorie invalide (« ${categoryRaw} ») pour l’équipe « ${teamNameRaw} ». Valeurs acceptées : ${categoriesListLabel}. Corrigez le fichier puis réessayez.`;
        } else {
          category = matched;
          const teamKey = normalizeCompareKey(teamNameRaw);
          const previous = teamCategoryInCsv.get(teamKey);
          if (previous && previous.category !== matched) {
            blockingErrors.push(
              `Import impossible : l’équipe « ${teamNameRaw} » a deux catégories différentes (ligne ${previous.lineNumber} : « ${previous.category} », ligne ${lineNumber} : « ${matched} »). Unifiez la catégorie puis réessayez.`,
            );
          } else if (!previous) {
            teamCategoryInCsv.set(teamKey, { category: matched, lineNumber });
          }
        }
      }
    } else if (categoryRaw) {
      error = `Catégorie « ${categoryRaw} » sans nom d’équipe (colonne team). Ajoutez une équipe ou retirez la catégorie, puis réessayez.`;
    }

    if (!error && firstName && lastName) {
      const personKey = `${normalizeCompareKey(firstName)}|${normalizeCompareKey(lastName)}`;
      const previousLine = seenInCsv.get(personKey);
      if (previousLine != null) {
        blockingErrors.push(
          `Import impossible : doublon dans le fichier pour « ${firstName} ${lastName} » (lignes ${previousLine} et ${lineNumber}). Gardez une seule ligne puis réessayez.`,
        );
      } else {
        seenInCsv.set(personKey, lineNumber);
      }
    }

    if (!error && email) {
      const previousEmailLine = seenEmailInCsv.get(email);
      if (previousEmailLine != null) {
        blockingErrors.push(
          `Import impossible : l’e-mail « ${email} » est utilisé sur deux lignes (${previousEmailLine} et ${lineNumber}). Un e-mail ne peut accepter qu’une seule invitation : corrigez le fichier puis réessayez.`,
        );
      } else {
        seenEmailInCsv.set(email, lineNumber);
      }
    }

    const personKey =
      firstName && lastName
        ? `${normalizeCompareKey(firstName)}|${normalizeCompareKey(lastName)}`
        : "";
    const existingMemberId = personKey
      ? (existingByKey.get(personKey) ?? null)
      : null;

    if (error) {
      blockingErrors.push(
        `Ligne ${lineNumber} : ${error}`,
      );
    }

    rows.push({
      lineNumber,
      firstName,
      lastName,
      role: role ?? MemberRoles.player,
      email,
      license,
      teamName,
      category,
      teamIgnoredForAdmin,
      error,
      existingMemberId,
    });
  }

  if (missingEmailLineNumbers.length > 1) {
    blockingErrors.push(
      `Import impossible : ${missingEmailLineNumbers.length} lignes sans e-mail (lignes ${missingEmailLineNumbers.join(", ")}). L’e-mail est obligatoire pour chaque membre à inviter : complétez le fichier puis réessayez.`,
    );
  }

  const uniqueLineBlocking = [...new Set(blockingErrors)];

  // Actions provisoires sur les lignes sans erreur locale — pour cumuler
  // aussi les contrôles globaux (dernier admin, etc.) dans la même liste.
  const provisionalMemberActions: MembersImportMemberAction[] = rows
    .filter((row) => !row.error)
    .map((row) => ({
      lineNumber: row.lineNumber,
      action: row.existingMemberId ? "update" : "create",
      existingMemberId: row.existingMemberId,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      email: row.email,
      license: row.license,
      teamName: row.teamName,
      category: row.category,
      teamIgnoredForAdmin: row.teamIgnoredForAdmin,
    }));

  const lastAdminErrors = blockingErrorsForLastAdmin({
    memberActions: provisionalMemberActions,
    existingMembers: params.existingMembers,
    adminIds: params.adminIds ?? [],
  });

  const allBlockingErrors = [
    ...new Set([...uniqueLineBlocking, ...lastAdminErrors]),
  ].sort((left, right) => {
    const lineLeft = Number(left.match(/Ligne (\d+)/)?.[1] ?? Number.MAX_SAFE_INTEGER);
    const lineRight = Number(
      right.match(/Ligne (\d+)/)?.[1] ?? Number.MAX_SAFE_INTEGER,
    );
    if (lineLeft !== lineRight) return lineLeft - lineRight;
    return left.localeCompare(right, "fr");
  });

  if (allBlockingErrors.length > 0) {
    return {
      blockingErrors: allBlockingErrors,
      rows,
      teamsToCreate: [],
      teamsToUpdate: [],
      memberActions: [],
      allowedCategories,
      stats: emptyStats,
    };
  }

  const teamActionsByName = new Map<string, MembersImportTeamAction>();
  for (const row of rows) {
    if (!row.teamName || row.role === MemberRoles.admin) continue;
    const key = normalizeCompareKey(row.teamName);
    if (teamActionsByName.has(key)) continue;
    const existing = teamsByName.get(key) ?? null;
    const categoryWillUpdate = Boolean(
      existing &&
        normalizeCompareKey(existing.category) !==
          normalizeCompareKey(row.category),
    );
    teamActionsByName.set(key, {
      name: existing?.name ?? row.teamName,
      category: row.category,
      existingTeamId: existing?.id ?? null,
      categoryWillUpdate,
    });
  }

  const teamsToCreate = [...teamActionsByName.values()].filter(
    (team) => !team.existingTeamId,
  );
  const teamsToUpdate = [...teamActionsByName.values()].filter(
    (team) => team.existingTeamId && team.categoryWillUpdate,
  );

  const memberActions = provisionalMemberActions;

  return {
    blockingErrors: [],
    rows,
    teamsToCreate,
    teamsToUpdate,
    memberActions,
    allowedCategories,
    stats: {
      createMembers: memberActions.filter((action) => action.action === "create")
        .length,
      updateMembers: memberActions.filter((action) => action.action === "update")
        .length,
      createTeams: teamsToCreate.length,
      updateTeams: teamsToUpdate.length,
      admins: memberActions.filter(
        (action) => action.role === MemberRoles.admin,
      ).length,
      withTeam: memberActions.filter((action) => Boolean(action.teamName)).length,
    },
  };
}
