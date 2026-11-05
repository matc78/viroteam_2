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

/** Rangs des rôles club (héritage cumulatif player ⊂ coach ⊂ admin). */
const ROLE_RANK: Record<string, number> = { player: 0, coach: 1, admin: 2 };

/** Type d'annonce ciblant des personnes (`targetIds` = ids de fiche). */
export const ANNOUNCEMENT_TARGET_PEOPLE = "Personnes";

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
}

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
  let players = stringList(team.playerIds);
  const nextPlayers = migrateTeamMemberIds(players, from, to);
  if (nextPlayers) players = nextPlayers;

  const pending = stringList(team.pendingPlayerIds);
  if (pending.includes(from)) {
    patch.pendingPlayerIds = pending.filter((id) => id !== from && id !== to);
    if (!players.includes(to)) players = [...players, to];
  }
  if (nextPlayers || patch.pendingPlayerIds) patch.playerIds = players;

  const nextCoaches = migrateTeamMemberIds(stringList(team.coachIds), from, to);
  if (nextCoaches) patch.coachIds = nextCoaches;

  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Patch d'événement : audience, RSVP (le vote le plus récent gagne),
 * `rsvpUpdatedAt`, `seenAt`, exclusions et appel coach (`attendance`).
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
      teamMemberIds: stringList(event.teamMemberIds),
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
    stringList(event.excludedMemberIds),
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
 * cible ; infos sportives de la source sauf si vides ; rôle le plus haut
 * (jamais de rétrogradation) ; équipes réunies ; date d'arrivée la plus ancienne.
 */
export function mergeMemberDocs(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...source, ...target };

  for (const key of ["playerInfo", "coachInfo"]) {
    const fromSource = objectMap(source[key]);
    if (fromSource && Object.keys(fromSource).length > 0) {
      merged[key] = fromSource;
    }
  }

  const sourceRole = String(source.role ?? "player");
  const targetRole = String(target.role ?? "player");
  merged.role =
    (ROLE_RANK[sourceRole] ?? 0) > (ROLE_RANK[targetRole] ?? 0)
      ? sourceRole
      : targetRole;

  for (const key of ["teamIds", "dismissedAnnouncementIds", "formerMemberIds"]) {
    const union = [...new Set([...stringList(source[key]), ...stringList(target[key])])];
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
