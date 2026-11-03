/**
 * Profils participants dénormalisés sur une conversation (`participantProfiles`).
 *
 * Un parent ne peut pas lister `clubs/{clubId}/members` : sans ce champ, le fil
 * n’affiche ni nom, ni avatar, ni rôle des expéditeurs. Écrit uniquement par
 * les Functions (règles : les clients ne touchent pas ce champ).
 *
 * Helpers purs (aucune dépendance à firebase-admin) pour `node --test`.
 */

/** Profil affichable d’un participant (clé = uid Auth). */
export type ChatParticipantProfile = {
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
  /** `player` | `coach` | `admin` | `parent` (participant sans fiche membre). */
  role: string;
};

/** Fiche minimale lue dans `members` (snapshot Firestore ou objet de test). */
export type MemberDocLike = {
  id: string;
  data: () => Record<string, unknown>;
};

const PARENT_ROLE = "parent";

function text(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function withAvatar(
  profile: Omit<ChatParticipantProfile, "avatarUrl">,
  avatarUrl: string,
): ChatParticipantProfile {
  return avatarUrl ? { ...profile, avatarUrl } : profile;
}

/** Uid Auth d’une fiche membre (`accountUid`, sinon `userId`), ou `null`. */
export function memberAuthUid(data: Record<string, unknown>): string | null {
  return text(data.accountUid) || text(data.userId) || null;
}

/** Profil depuis une fiche `members/{id}` (nom + avatar du snapshot). */
export function profileFromMember(
  data: Record<string, unknown>,
): ChatParticipantProfile {
  const snapshot =
    data.snapshot && typeof data.snapshot === "object"
      ? (data.snapshot as Record<string, unknown>)
      : {};
  const firstName = text(data.firstName);
  const lastName = text(data.lastName);
  const displayName =
    text(snapshot.displayName) || `${firstName} ${lastName}`.trim();
  return withAvatar(
    { firstName, lastName, displayName, role: text(data.role) || "player" },
    text(snapshot.avatarUrl),
  );
}

/** Profil depuis `users/{uid}` pour un participant sans fiche (parent). */
export function profileFromUser(
  data: Record<string, unknown>,
): ChatParticipantProfile {
  const firstName = text(data.firstName);
  const lastName = text(data.lastName);
  const displayName = text(data.displayName) || `${firstName} ${lastName}`.trim();
  return withAvatar(
    { firstName, lastName, displayName, role: PARENT_ROLE },
    text(data.avatarUrl),
  );
}

/**
 * Annuaire uid Auth → profil depuis les fiches membres du club.
 * Une fiche active l’emporte sur une fiche archivée du même compte.
 */
export function memberDirectoryFromDocs(
  docs: MemberDocLike[],
): Map<string, ChatParticipantProfile> {
  const directory = new Map<string, ChatParticipantProfile>();
  const archivedUids = new Set<string>();
  for (const doc of docs) {
    const data = doc.data();
    const uid = memberAuthUid(data);
    if (!uid) continue;
    const archived = text(data.status) === "archived";
    if (directory.has(uid) && (archived || !archivedUids.has(uid))) continue;
    directory.set(uid, profileFromMember(data));
    if (archived) archivedUids.add(uid);
    else archivedUids.delete(uid);
  }
  return directory;
}

/** Vrai si les deux maps de profils sont identiques (ordre des clés ignoré). */
export function participantProfilesEqual(a: unknown, b: unknown): boolean {
  return stableJson(a ?? {}) === stableJson(b ?? {});
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
