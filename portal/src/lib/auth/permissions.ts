/**
 * Catalogue des droits club.
 *
 * Seule la liste `members/{id}.permissions` fait foi. Les fonctions
 * (Responsable cotisations…) ne sont que des raccourcis qui calculent cette
 * liste. Source canonique partagée avec l'app
 * et les Functions : `shared/permissions_catalog.json` (parité testée).
 */

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
 * La relation entraîneur d'équipe se règle dans l'équipe, pas ici.
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

/** Droits connus d'une liste Firestore (identifiants inconnus ignorés). */
export function parsePermissions(raw: unknown): ClubPermission[] {
  if (!Array.isArray(raw)) return [];
  return CLUB_PERMISSIONS.filter((permission) => raw.includes(permission));
}

/**
 * Liste normalisée telle qu'elle est stockée : sans doublon, dans l'ordre du
 * catalogue, droits impliqués ajoutés, réduite à `['admin']` si présent.
 */
export function normalizePermissions(
  permissions: readonly ClubPermission[],
): ClubPermission[] {
  const granted = new Set<ClubPermission>();
  for (const permission of permissions) {
    granted.add(permission);
    for (const implied of PERMISSION_IMPLIES[permission] ?? []) {
      granted.add(implied);
    }
  }
  if (granted.has(PERMISSION_ADMIN)) return [PERMISSION_ADMIN];
  return CLUB_PERMISSIONS.filter((permission) => granted.has(permission));
}

/** Vrai si `permissions` accorde `permission` (`admin` accorde tout). */
export function grantsPermission(
  permissions: readonly ClubPermission[],
  permission: ClubPermission,
): boolean {
  return (
    permissions.includes(PERMISSION_ADMIN) || permissions.includes(permission)
  );
}

/** Vrai si la fiche porte le droit Administrateur (badge Admin). */
export function isAdminMember(member: {
  permissions: readonly ClubPermission[];
}): boolean {
  return member.permissions.includes(PERMISSION_ADMIN);
}

/** État d'une fonction pour une liste de droits : cochée, partielle ou absente. */
export function functionState(
  clubFunction: ClubFunction,
  permissions: readonly ClubPermission[],
): "full" | "partial" | "none" {
  const required: readonly ClubPermission[] = CLUB_FUNCTIONS[clubFunction];
  const held = required.filter((permission) =>
    grantsPermission(permissions, permission),
  );
  if (held.length === required.length) return "full";
  return held.length > 0 ? "partial" : "none";
}

/**
 * Droit de `permissions` qui accorde d'office `permission` (ex. `manageFees`
 * pour `viewFees`), ou `null`. Sert à cocher et griser la case impliquée.
 */
export function impliedByPermission(
  permission: ClubPermission,
  permissions: readonly ClubPermission[],
): ClubPermission | null {
  for (const holder of permissions) {
    if (PERMISSION_IMPLIES[holder]?.includes(permission)) return holder;
  }
  return null;
}

/**
 * Badges d'une fiche, par priorité décroissante (mêmes ids que l'app et les
 * Functions). Dérivés, jamais stockés.
 */
export const MEMBER_BADGES = ["admin", "coach", "player", "member"] as const;
export type MemberBadge = (typeof MEMBER_BADGES)[number];

/**
 * Seule liste des badges affichables : ceux d'une fiche, plus Parent (déduit
 * des liens parent, pas de la fiche) et Sparring (joueur sparring d'une
 * équipe, affiché seulement quand une équipe est en contexte). Libellés :
 * `@/lib/copy/badgeCopy`.
 */
export const DISPLAY_BADGES = [...MEMBER_BADGES, "parent", "sparring"] as const;
export type DisplayBadge = (typeof DISPLAY_BADGES)[number];

/** Badge affichable, ou `member` (gris) si inconnu ou absent. */
export function toDisplayBadge(value: unknown): DisplayBadge {
  return DISPLAY_BADGES.find((badge) => badge === value) ?? "member";
}

/** Champs d'une fiche dont se déduisent ses badges. */
export type MemberBadgeSource = {
  permissions: readonly ClubPermission[];
  coachTeamIds: readonly string[];
  teamIds: readonly string[];
};

/**
 * Badges d'une fiche, par priorité décroissante : Admin (droit `admin`),
 * Entraîneur (coach d'au moins une équipe), Joueur (dans un effectif).
 * Sans droit admin ni équipe ⇒ `["member"]` (jamais vide). Parent se déduit
 * des liens, pas de la fiche.
 */
export function derivedBadges(member: MemberBadgeSource): MemberBadge[] {
  const badges: MemberBadge[] = [];
  if (isAdminMember(member)) badges.push("admin");
  if (member.coachTeamIds.length > 0) badges.push("coach");
  if (member.teamIds.some((teamId) => !member.coachTeamIds.includes(teamId))) {
    badges.push("player");
  }
  return badges.length > 0 ? badges : ["member"];
}

/** Badge Admin ou Entraîneur : encadrement (listé à part des joueurs). */
export function hasStaffBadge(member: MemberBadgeSource): boolean {
  const badges = derivedBadges(member);
  return badges.includes("admin") || badges.includes("coach");
}

/** Badge principal d'une fiche : Admin > Entraîneur > Joueur > Membre. */
export function primaryBadge(member: MemberBadgeSource): MemberBadge {
  return derivedBadges(member)[0];
}

/** Droits effectifs d'un compte dans un club (fiche `members/{uid}`). */
export type ClubAccess = {
  /** Droits stockés sur la fiche (identifiants connus). */
  permissions: ClubPermission[];
  /** Droit Administrateur : implique tous les autres. */
  isAdmin: boolean;
  /** Équipes entraînées (`members.coachTeamIds`). */
  coachTeamIds: string[];
  /** Équipes de la fiche (joueur ou coach). */
  teamIds: string[];
  /** Coach d'au moins une équipe. */
  isTeamCoach: boolean;
  /** Encadrement : au moins un droit, ou coach d'équipe. */
  isStaff: boolean;
  /** Réglages coach du club (`clubs.coachPermissions`). */
  coachFlags: Record<CoachFlag, boolean>;
};

/** Aucun droit : compte sans fiche dans le club (parent seul, chargement). */
export const NO_CLUB_ACCESS: ClubAccess = {
  permissions: [],
  isAdmin: false,
  coachTeamIds: [],
  teamIds: [],
  isTeamCoach: false,
  isStaff: false,
  coachFlags: { ...COACH_FLAG_DEFAULTS },
};

function stringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

/**
 * Droits effectifs à partir des données de la fiche `members/{uid}`
 * (`null` : pas de fiche) et des réglages coach du club.
 */
export function buildClubAccess(
  member: Record<string, unknown> | null,
  coachFlags: Record<CoachFlag, boolean> = { ...COACH_FLAG_DEFAULTS },
): ClubAccess {
  if (!member) return { ...NO_CLUB_ACCESS, coachFlags };
  const permissions = parsePermissions(member.permissions);
  const coachTeamIds = [...new Set(stringList(member.coachTeamIds))];
  return {
    permissions,
    isAdmin: isAdminMember({ permissions }),
    coachTeamIds,
    teamIds: stringList(member.teamIds),
    isTeamCoach: coachTeamIds.length > 0,
    isStaff: permissions.length > 0 || coachTeamIds.length > 0,
    coachFlags,
  };
}

/** Vrai si `access` accorde `permission` (`admin` accorde tout). */
export function can(access: ClubAccess, permission: ClubPermission): boolean {
  return grantsPermission(access.permissions, permission);
}

/** Coach d'équipe et capacité `flag` accordée par le club. */
export function coachCan(access: ClubAccess, flag: CoachFlag): boolean {
  return access.isTeamCoach && access.coachFlags[flag];
}

/** Coach d'au moins une des `teamIds`. */
export function coachesAnyTeam(
  access: ClubAccess,
  teamIds: readonly string[],
): boolean {
  return teamIds.some((teamId) => access.coachTeamIds.includes(teamId));
}

/** `teamIds` non vide et toutes entraînées par le compte. */
export function coachesAllTeams(
  access: ClubAccess,
  teamIds: readonly string[],
): boolean {
  return (
    teamIds.length > 0 &&
    teamIds.every((teamId) => access.coachTeamIds.includes(teamId))
  );
}

/** Ajouter / inviter un membre : droit membres ou coach autorisé. */
export function canAddMembers(access: ClubAccess): boolean {
  return can(access, "manageMembers") || coachCan(access, "canInvitePlayers");
}

/** Ajouter un joueur à l'équipe `teamId` (le retrait exige `manageTeams`). */
export function canAddPlayerToTeam(access: ClubAccess, teamId: string): boolean {
  return (
    can(access, "manageTeams") ||
    (access.coachTeamIds.includes(teamId) &&
      coachCan(access, "canManageTeamRoster"))
  );
}

/** Partager le code d'invitation de l'équipe `teamId`. */
export function canShareTeamInvite(access: ClubAccess, teamId: string): boolean {
  return (
    can(access, "manageMembers") ||
    (access.coachTeamIds.includes(teamId) &&
      coachCan(access, "canInvitePlayers"))
  );
}

/**
 * Gérer le lien FFVB de l'équipe `teamId` (actualiser, délier) : droit
 * équipes ou coach de l'équipe (même règle que `assertCanManageFederation`).
 */
export function canManageTeamFederation(
  access: ClubAccess,
  teamId: string,
): boolean {
  return can(access, "manageTeams") || access.coachTeamIds.includes(teamId);
}

/** Peut créer un événement pour au moins une équipe. */
export function canCreateEvents(access: ClubAccess): boolean {
  return can(access, "manageEvents") || coachCan(access, "canCreateEvents");
}

/** Créer un événement pour `teamIds` : toutes doivent être les siennes. */
export function canCreateEventFor(
  access: ClubAccess,
  teamIds: readonly string[],
): boolean {
  return (
    can(access, "manageEvents") ||
    (coachCan(access, "canCreateEvents") && coachesAllTeams(access, teamIds))
  );
}

/** Portée d'un événement : ses équipes et le drapeau « tout le club ». */
export type EventScope = {
  teamIds: readonly string[];
  allTeams?: boolean;
};

/**
 * Coach de toutes les équipes d'un événement qui n'est pas « tout le club »
 * (condition coach pour modifier, annuler, notifier, convoquer).
 */
function coachOwnsEvent(access: ClubAccess, event: EventScope): boolean {
  return event.allTeams !== true && coachesAllTeams(access, event.teamIds);
}

/**
 * Modifier / annuler un événement : droit planning, ou coach autorisé de
 * toutes ses équipes (jamais sur un événement « tout le club »).
 */
export function canManageEvent(
  access: ClubAccess,
  event: EventScope,
): boolean {
  return (
    can(access, "manageEvents") ||
    (coachCan(access, "canCreateEvents") && coachOwnsEvent(access, event))
  );
}

/**
 * Convocations et notification d'un événement : droit planning, ou coach de
 * toutes ses équipes (jamais sur un événement « tout le club »).
 */
export function canManageEventAudience(
  access: ClubAccess,
  event: EventScope,
): boolean {
  return can(access, "manageEvents") || coachOwnsEvent(access, event);
}

/**
 * Modifier la réponse d'un autre membre : droit planning, ou coach autorisé
 * d'une de ses équipes (jamais sur un événement « tout le club »).
 */
export function canEditMemberRsvp(
  access: ClubAccess,
  event: EventScope,
): boolean {
  return (
    can(access, "manageEvents") ||
    (event.allTeams !== true &&
      coachCan(access, "canEditMemberRsvp") &&
      coachesAnyTeam(access, event.teamIds))
  );
}

/** Modifier la licence d'un membre des équipes `memberTeamIds`. */
export function canEditMemberLicense(
  access: ClubAccess,
  memberTeamIds: readonly string[],
): boolean {
  return (
    can(access, "manageMembers") ||
    (coachCan(access, "canEditMemberLicenses") &&
      coachesAnyTeam(access, memberTeamIds))
  );
}

/** Peut publier une annonce (au club, ou seulement à ses équipes). */
export function canPublishAnnouncements(access: ClubAccess): boolean {
  return (
    can(access, "manageAnnouncements") ||
    coachCan(access, "canPublishTeamAnnouncements")
  );
}

/** Publier / modifier une annonce ciblant uniquement les équipes `teamIds`. */
export function canPublishAnnouncementToTeams(
  access: ClubAccess,
  teamIds: readonly string[],
): boolean {
  return (
    can(access, "manageAnnouncements") ||
    (coachCan(access, "canPublishTeamAnnouncements") &&
      coachesAllTeams(access, teamIds))
  );
}

/** Écrire dans un canal réservé aux coachs et responsables. */
export function canWriteStaffChannels(access: ClubAccess): boolean {
  return can(access, "manageChat") || access.isTeamCoach;
}
