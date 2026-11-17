/**
 * Catalogue des droits club (fonctions pures, testables sans Firestore).
 *
 * Seule la liste `members/{id}.permissions` fait foi. Les fonctions
 * (Responsable cotisations…) ne sont que des raccourcis qui calculent cette
 * liste. Source canonique partagée avec l'app
 * et le portail : `shared/permissions_catalog.json` (parité testée).
 */

import { stringArray } from "./common";

export const PERMISSION_ADMIN = "admin";

/** Droits club, dans l'ordre canonique du catalogue. */
export const CLUB_PERMISSIONS = [
  PERMISSION_ADMIN,
  "manageMembers",
  "manageTeams",
  "manageEvents",
  "manageAnnouncements",
  "manageFees",
  "viewFees",
  "manageClubSettings",
  "manageEquipment",
  "manageChat",
  "viewActivity",
] as const;
export type ClubPermission = (typeof CLUB_PERMISSIONS)[number];

/** Droits accordés d'office par un autre droit. */
export const PERMISSION_IMPLIES: Partial<
  Record<ClubPermission, readonly ClubPermission[]>
> = {
  manageFees: ["viewFees"],
};

/**
 * Fonctions prédéfinies : raccourcis (groupes de droits club) à l'attribution.
 * La relation entraîneur d'équipe se règle dans `teams.coachIds`, pas ici.
 */
export const CLUB_FUNCTIONS = {
  feesManager: ["manageFees", "viewFees"],
  announcementsManager: ["manageAnnouncements"],
  membersManager: ["manageMembers", "manageTeams"],
  sportsManager: ["manageEvents", "manageTeams"],
  equipmentManager: ["manageEquipment"],
} as const satisfies Record<string, readonly ClubPermission[]>;
export type ClubFunction = keyof typeof CLUB_FUNCTIONS;

/**
 * Capacités d'un coach d'équipe (relation `teams.coachIds`) sur ses équipes,
 * réglées pour tout le club dans `clubs/{clubId}.coachPermissions`.
 */
export const COACH_FLAG_DEFAULTS = {
  canCreateEvents: true,
  canManageTeamRoster: true,
  canInvitePlayers: true,
  canTakeAttendance: true,
  canPublishTeamAnnouncements: true,
  canEditMemberLicenses: false,
  canEditMemberRsvp: false,
} as const;
export type CoachFlag = keyof typeof COACH_FLAG_DEFAULTS;

/** Vrai si `value` est un identifiant de droit du catalogue. */
export function isClubPermission(value: unknown): value is ClubPermission {
  return (
    typeof value === "string" &&
    (CLUB_PERMISSIONS as readonly string[]).includes(value)
  );
}

/** Identifiants de `raw` absents du catalogue (liste vide si tout est connu). */
export function unknownPermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => !isClubPermission(item))
    .map((item) => String(item));
}

/**
 * Liste de droits normalisée, telle qu'elle est stockée sur la fiche :
 * identifiants connus seulement, sans doublon, dans l'ordre du catalogue.
 * `admin` implique tout : la liste se réduit alors à `['admin']`. Les droits
 * impliqués (`manageFees` ⇒ `viewFees`) sont ajoutés.
 */
export function normalizePermissions(raw: unknown): ClubPermission[] {
  const granted = new Set<ClubPermission>();
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!isClubPermission(item)) continue;
    granted.add(item);
    for (const implied of PERMISSION_IMPLIES[item] ?? []) granted.add(implied);
  }
  if (granted.has(PERMISSION_ADMIN)) return [PERMISSION_ADMIN];
  return CLUB_PERMISSIONS.filter((permission) => granted.has(permission));
}

/** Vrai si la liste stockée `raw` accorde `permission` (`admin` accorde tout). */
export function grantsPermission(
  raw: unknown,
  permission: ClubPermission,
): boolean {
  if (!Array.isArray(raw)) return false;
  return raw.includes(PERMISSION_ADMIN) || raw.includes(permission);
}

/** Vrai si la liste stockée `raw` porte le droit Administrateur. */
export function grantsAdmin(raw: unknown): boolean {
  return grantsPermission(raw, PERMISSION_ADMIN);
}

/** Valeur d'un flag coach dans `clubs.coachPermissions` (défaut du catalogue). */
export function coachFlagValue(coachPermissions: unknown, flag: CoachFlag): boolean {
  const map =
    coachPermissions && typeof coachPermissions === "object"
      ? (coachPermissions as Record<string, unknown>)
      : {};
  const value = map[flag];
  return typeof value === "boolean" ? value : COACH_FLAG_DEFAULTS[flag];
}

export const BADGE_ADMIN = "admin";
export const BADGE_COACH = "coach";
export const BADGE_PLAYER = "player";
export const BADGE_MEMBER = "member";
export type MemberBadge =
  | typeof BADGE_ADMIN
  | typeof BADGE_COACH
  | typeof BADGE_PLAYER
  | typeof BADGE_MEMBER;

/**
 * Badges d'une fiche membre, par priorité décroissante : Admin (droit
 * `admin`), Entraîneur (coach d'au moins une équipe), Joueur (dans un
 * effectif). Ni admin ni équipe ⇒ `[member]` (badge gris « Membre »). Parent
 * se déduit des liens, pas de la fiche.
 */
export function derivedBadges(member: {
  permissions?: unknown;
  coachTeamIds?: unknown;
  teamIds?: unknown;
}): MemberBadge[] {
  const badges: MemberBadge[] = [];
  if (grantsAdmin(member.permissions)) badges.push(BADGE_ADMIN);
  const coachTeamIds = stringArray(member.coachTeamIds);
  if (coachTeamIds.length > 0) badges.push(BADGE_COACH);
  const playsInTeam = stringArray(member.teamIds).some(
    (teamId) => !coachTeamIds.includes(teamId),
  );
  if (playsInTeam) badges.push(BADGE_PLAYER);
  return badges.length > 0 ? badges : [BADGE_MEMBER];
}

/** Badge principal d'une fiche (bulle de chat, avatar) : Admin > Entraîneur > Joueur > Membre. */
export function primaryBadge(member: {
  permissions?: unknown;
  coachTeamIds?: unknown;
  teamIds?: unknown;
}): MemberBadge {
  return derivedBadges(member)[0];
}

/** Droits effectifs d'un compte dans un club (fiche `members/{uid}`). */
export type ClubAccess = {
  clubId: string;
  uid: string;
  /** Données du club (`clubs/{clubId}`). */
  club: Record<string, unknown>;
  /** Données de la fiche de l'appelant, `null` s'il n'est pas membre. */
  member: Record<string, unknown> | null;
  /** Droits stockés sur la fiche (identifiants connus). */
  permissions: ClubPermission[];
  /** Droit Administrateur : implique tous les autres. */
  isAdmin: boolean;
  /** Équipes dont l'appelant est coach (`members.coachTeamIds`). */
  coachTeamIds: string[];
  /** Coach d'au moins une équipe. */
  isTeamCoach: boolean;
  /** Vrai si la fiche accorde `permission` (`admin` accorde tout). */
  can(permission: ClubPermission): boolean;
  /** Vrai si l'appelant est coach d'au moins une des `teamIds`. */
  coachesAnyTeam(teamIds: readonly string[]): boolean;
  /** Vrai si `teamIds` est non vide et que l'appelant les entraîne toutes. */
  coachesAllTeams(teamIds: readonly string[]): boolean;
  /** Vrai si l'appelant est coach d'équipe et que le club active `flag`. */
  coachCan(flag: CoachFlag): boolean;
};

/**
 * Construit les droits effectifs d'un compte à partir du club et de sa
 * fiche. Seul endroit où `permissions` et `coachTeamIds` sont interprétés.
 */
export function buildClubAccess(params: {
  clubId: string;
  uid: string;
  club: Record<string, unknown>;
  member: Record<string, unknown> | null;
}): ClubAccess {
  const { clubId, uid, club, member } = params;
  const permissions = normalizePermissions(member?.permissions);
  const coachTeamIds = [...new Set(stringArray(member?.coachTeamIds))];
  const isAdmin = permissions.includes(PERMISSION_ADMIN);
  const isTeamCoach = coachTeamIds.length > 0;
  return {
    clubId,
    uid,
    club,
    member,
    permissions,
    isAdmin,
    coachTeamIds,
    isTeamCoach,
    can: (permission) => isAdmin || permissions.includes(permission),
    coachesAnyTeam: (teamIds) =>
      teamIds.some((teamId) => coachTeamIds.includes(teamId)),
    coachesAllTeams: (teamIds) =>
      teamIds.length > 0 &&
      teamIds.every((teamId) => coachTeamIds.includes(teamId)),
    coachCan: (flag) =>
      isTeamCoach && coachFlagValue(club.coachPermissions, flag),
  };
}

/**
 * Index `clubs.adminIds` après écriture des droits d'une fiche : contient
 * les fiches liées à un compte qui portent le droit Administrateur. Une
 * fiche non liée (`linked` false) n'y figure jamais. Jamais utilisé pour
 * autoriser : sert aux audiences (chat, notifications).
 */
export function adminIdsAfterPermissionsChange(params: {
  adminIds: readonly string[];
  memberId: string;
  linked: boolean;
  permissions: unknown;
}): string[] {
  const others = params.adminIds.filter((id) => id !== params.memberId);
  const next =
    params.linked && grantsAdmin(params.permissions)
      ? [...others, params.memberId]
      : others;
  return [...new Set(next)];
}

/**
 * Seul calcul d'écriture de l'index `clubs.adminIds` : nouvel index après
 * écriture de la fiche `memberId` (droits, liaison ou retrait — `linked`
 * false), ou `null` s'il ne change pas. `formerMemberIds` (re-keying) sont
 * retirés de l'index.
 */
export function adminIdsUpdate(params: {
  adminIds: readonly string[];
  memberId: string;
  linked: boolean;
  permissions: unknown;
  formerMemberIds?: readonly string[];
}): string[] | null {
  const former = new Set(params.formerMemberIds ?? []);
  const next = adminIdsAfterPermissionsChange({
    ...params,
    adminIds: params.adminIds.filter((id) => !former.has(id)),
  });
  const unchanged =
    next.length === params.adminIds.length &&
    next.every((id, index) => id === params.adminIds[index]);
  return unchanged ? null : next;
}

/**
 * Vrai si retirer le droit Administrateur à `memberId` (ou retirer la fiche)
 * laisserait le club sans admin lié à un compte.
 */
export function isLastAdmin(params: {
  adminIds: readonly string[];
  memberId: string;
}): boolean {
  return params.adminIds.every((id) => id === params.memberId);
}

/**
 * Vrai si la fiche fait partie de l'encadrement du club (canal staff) :
 * au moins un droit, ou coach d'au moins une équipe.
 */
export function isStaffMember(member: {
  permissions?: unknown;
  coachTeamIds?: unknown;
}): boolean {
  return (
    normalizePermissions(member.permissions).length > 0 ||
    stringArray(member.coachTeamIds).length > 0
  );
}
