/**
 * Re-keying d'une fiche membre sur l'uid de son compte (fonctions pures,
 * testables avec `node --test`).
 *
 * Invariant (« une seule clé membre », 5 nov. 2026) : une fiche liée à un
 * compte vit à `members/{accountUid}` ; l'id de fiche est la seule clé membre
 * partout (rosters, RSVP, guardians, cotisations, annonces, invitations,
 * parentLinks, adminIds). Une fiche pré-inscrite garde un id aléatoire tant
 * qu'elle n'est pas liée ; à la liaison, elle est re-clée (`memberRekey.ts`).
 */
import {
  buildEventAudienceMigrationPatch,
  legacyRsvpIsNewer,
  migrateTeamMemberIds,
} from "./eventAudienceMigrate";
import { stringArray } from "./common";
import { normalizePermissions } from "./permissionsCatalog";

/** Type d'annonce ciblant des personnes (`targetIds` = ids de fiche). */
export const ANNOUNCEMENT_TARGET_PEOPLE = "Personnes";

function objectMap(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function timestampMillis(value: unknown): number | null {
  if (value && typeof value === "object" && "toMillis" in value) {
    const millis = (value as { toMillis?: () => number }).toMillis?.();
    return typeof millis === "number" ? millis : null;
  }
  return null;
}

/**
 * Patch d'équipe : remplace [from] par [to] dans `playerIds` / `coachIds` ;
 * une fiche en attente (`pendingPlayerIds`) liée devient joueur.
 * Retourne `null` si rien ne change.
 */
export function buildTeamRekeyPatch(
  team: Record<string, unknown>,
  from: string,
  to: string,
): Record<string, string[]> | null {
  if (!from || !to || from === to) return null;
  const patch: Record<string, string[]> = {};
  let players = stringArray(team.playerIds);
  const nextPlayers = migrateTeamMemberIds(players, from, to);
  if (nextPlayers) players = nextPlayers;

  const pending = stringArray(team.pendingPlayerIds);
  if (pending.includes(from)) {
    patch.pendingPlayerIds = pending.filter((id) => id !== from && id !== to);
    if (!players.includes(to)) players = [...players, to];
  }
  if (nextPlayers || patch.pendingPlayerIds) patch.playerIds = players;

  const nextCoaches = migrateTeamMemberIds(stringArray(team.coachIds), from, to);
  if (nextCoaches) patch.coachIds = nextCoaches;

  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Patch d'événement : audience, RSVP (le vote le plus récent gagne),
 * `rsvpUpdatedAt`, `seenAt`, exclusions et ancien appel coach (`attendance`, historique).
 * Retourne `null` si rien ne change (un second passage est donc un no-op).
 */
export function buildEventRekeyPatch(params: {
  event: Record<string, unknown>;
  from: string;
  to: string;
  deleteField: unknown;
}): Record<string, unknown> | null {
  const { event, from, to, deleteField } = params;
  if (!from || !to || from === to) return null;
  const rsvpUpdatedAt = objectMap(event.rsvpUpdatedAt);
  const patch: Record<string, unknown> = {
    ...(buildEventAudienceMigrationPatch({
      teamMemberIds: stringArray(event.teamMemberIds),
      rsvp: objectMap(event.rsvp),
      rsvpUpdatedAt,
      seenAt: objectMap(event.seenAt),
      legacyId: from,
      canonicalId: to,
      deleteField,
      preferLegacyWhenBoth: legacyRsvpIsNewer(rsvpUpdatedAt, from, to),
    }) ?? {}),
  };

  const nextExcluded = migrateTeamMemberIds(
    stringArray(event.excludedMemberIds),
    from,
    to,
  );
  if (nextExcluded) patch.excludedMemberIds = nextExcluded;

  const attendance = objectMap(event.attendance);
  if (attendance && from in attendance) {
    patch[`attendance.${from}`] = deleteField;
    // Un appel déjà fait sous la clé canonique est conservé.
    if (!(to in attendance) && attendance[from] != null) {
      patch[`attendance.${to}`] = attendance[from];
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Lien parent ↔ enfant de `users/{parentUid}.parentLinks[]`. */
export type ParentLinkEntry = Record<string, unknown> & {
  clubId?: unknown;
  memberId?: unknown;
  status?: unknown;
};

/**
 * Réécrit `parentLinks` : `memberId` [from] → [to] dans [clubId]. Si un lien
 * vers [to] existe déjà, un seul est gardé (l'actif de préférence).
 * Retourne `null` si rien ne change.
 */
export function rewriteParentLinks(
  links: unknown,
  clubId: string,
  from: string,
  to: string,
): ParentLinkEntry[] | null {
  if (!Array.isArray(links) || !from || !to || from === to) return null;
  const entries = links.filter(
    (link): link is ParentLinkEntry => Boolean(link) && typeof link === "object",
  );
  const concerns = (link: ParentLinkEntry, id: string) =>
    String(link.clubId ?? "") === clubId && String(link.memberId ?? "") === id;
  if (!entries.some((link) => concerns(link, from))) return null;

  const candidates = entries
    .filter((link) => concerns(link, from) || concerns(link, to))
    .map((link) => ({ ...link, memberId: to }));
  const kept =
    candidates.find((link) => String(link.status ?? "") === "active") ??
    candidates[0];
  const others = entries.filter(
    (link) => !concerns(link, from) && !concerns(link, to),
  );
  return [...others, kept];
}

/**
 * Fusionne deux fiches d'une même personne (collision : la fiche pré-inscrite
 * [source] et une fiche déjà à l'uid [target]). Identité (nom, snapshot) de la
 * cible ; infos sportives de la source sauf si vides ; droits réunis (jamais
 * de retrait) ; équipes réunies ; date d'arrivée la plus ancienne.
 */
export function mergeMemberDocs(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...source, ...target };

  for (const key of ["playerInfo"]) {
    const fromSource = objectMap(source[key]);
    if (fromSource && Object.keys(fromSource).length > 0) {
      merged[key] = fromSource;
    }
  }

  // Droits réunis : une fusion ne retire jamais un droit.
  merged.permissions = normalizePermissions([
    ...stringArray(source.permissions),
    ...stringArray(target.permissions),
  ]);

  for (const key of [
    "teamIds",
    "coachTeamIds",
    "dismissedAnnouncementIds",
    "formerMemberIds",
  ]) {
    const union = [...new Set([...stringArray(source[key]), ...stringArray(target[key])])];
    if (union.length > 0 || key in merged) merged[key] = union;
  }

  if (source.status === "active" || target.status === "active") {
    merged.status = "active";
  }

  const sourceJoined = timestampMillis(source.joinedAt);
  const targetJoined = timestampMillis(target.joinedAt);
  if (
    sourceJoined != null &&
    (targetJoined == null || sourceJoined < targetJoined)
  ) {
    merged.joinedAt = source.joinedAt;
  }
  return merged;
}

/** Une cotisation et le nombre de ses `payment_events`. */
export type FeeState = {
  data: Record<string, unknown>;
  paymentEventCount: number;
} | null;

/** Décision de déplacement de `member_fees/{from}` vers `member_fees/{to}`. */
export type FeeMoveDecision =
  | "none"
  | "move"
  | "drop-empty-source"
  | "drop-empty-target-then-move"
  | "conflict";

/** Cotisation sans encaissement, aide ni historique de paiement. */
export function feeIsEmpty(fee: NonNullable<FeeState>): boolean {
  const paid = Number(fee.data.amountPaidCents ?? 0);
  return (
    (!Number.isFinite(paid) || paid <= 0) &&
    (!Array.isArray(fee.data.aids) || fee.data.aids.length === 0) &&
    fee.paymentEventCount === 0
  );
}

/**
 * Que faire de la cotisation de [source] quand la fiche passe sous [target] :
 * déplacer, supprimer la vide, ou signaler un conflit (deux cotisations
 * avec de l'argent ou un historique : un admin tranche).
 */
export function feeMoveDecision(source: FeeState, target: FeeState): FeeMoveDecision {
  if (!source) return "none";
  if (!target) return "move";
  if (feeIsEmpty(source)) return "drop-empty-source";
  if (feeIsEmpty(target)) return "drop-empty-target-then-move";
  return "conflict";
}

/** Échecs après lesquels la reprise automatique abandonne (un humain reprend). */
export const REKEY_RESUME_MAX_FAILURES = 10;

/** Délai minimal depuis la dernière écriture de la fiche avant une reprise. */
export const REKEY_RESUME_MIN_AGE_MS = 10 * 60 * 1000;

/**
 * Faut-il reprendre la réécriture des références d'une fiche re-clée
 * (`rekeyPendingFrom` encore posé) ? Non si : rien en attente, conflit de
 * cotisation (un admin tranche), trop d'échecs, ou fiche écrite il y a moins
 * de [REKEY_RESUME_MIN_AGE_MS] (la réécriture inline est peut-être en cours).
 */
export function shouldResumeRekey(params: {
  memberId: string;
  pendingFrom: unknown;
  failureCount: unknown;
  feeConflictSeasonIds: unknown;
  lastWriteMs: number | null;
  nowMs: number;
}): boolean {
  const from = typeof params.pendingFrom === "string" ? params.pendingFrom.trim() : "";
  if (!from || from === params.memberId) return false;
  if (stringArray(params.feeConflictSeasonIds).length > 0) return false;
  const failures = Number(params.failureCount ?? 0);
  if (Number.isFinite(failures) && failures >= REKEY_RESUME_MAX_FAILURES) return false;
  if (params.lastWriteMs != null && params.nowMs - params.lastWriteMs < REKEY_RESUME_MIN_AGE_MS) {
    return false;
  }
  return true;
}
