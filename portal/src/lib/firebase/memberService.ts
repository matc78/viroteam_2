import {
  MEMBER_BADGES,
  normalizePermissions,
  parsePermissions,
  primaryBadge,
  type ClubPermission,
  type MemberBadgeSource,
} from "@/lib/auth/permissions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentReference,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import { linkedAccountUid } from "./memberRefs";
import { validateEmail } from "@/lib/auth/validateEmail";
import {
  formatFirstName,
  formatLastName,
  formatLicense,
} from "@/lib/format/personDataFormat";
import { joinCopy } from "@/lib/copy/joinCopy";
import { site, webJoinRedirectPath } from "@/lib/site";
import { appStoreLink, playStoreLink } from "@/lib/storeLinks";
import { permissionsCopy } from "@/lib/copy/permissionsCopy";
import {
  CallableError,
  removeMember as removeMemberCallable,
  setMemberPermissions as setMemberPermissionsCallable,
} from "./callableService";
import type { ClubRecord } from "./clubService";
import {
  Collections,
  Fields,
  InvitationStatus,
  InvitationTypes,
} from "./constants";
import { toDate } from "./types";
import {
  appendClubActivityToTransaction,
  ClubActivityTypes,
} from "./activityService";


/** Membre club enrichi pour le portail (badges : `derivedBadges`). */
export type ClubMemberRecord = {
  memberId: string;
  /** Droits club de la fiche (seule autorité, écrits par les Functions). */
  permissions: ClubPermission[];
  /** Équipes entraînées (`coachTeamIds`, dérivé de `teams.coachIds`). */
  coachTeamIds: string[];
  status: string;
  firstName: string;
  lastName: string;
  displayName: string;
  accountUid: string | null;
  email: string | null;
  avatarUrl: string | null;
  teamIds: string[];
  license: string;
  activeInvitationId: string | null;
  pendingInviteCode: string | null;
  pendingInviteExpiresAt: Date | null;
  hasLinkedAccount: boolean;
  joinedAt: Date | null;
};

/** Invitation créée avec un membre. */
export type ClubInvitationRecord = {
  id: string;
  clubId: string;
  code: string;
  status: string;
  memberId: string;
  sentBy: string;
  expiresAt: Date;
  clubName: string;
  clubSport: string;
  firstName: string;
  lastName: string;
};

/** Résultat d’ajout membre + invitation. */
export type AddMemberResult = {
  member: ClubMemberRecord;
  invitation: ClubInvitationRecord;
};

const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 6;
const INVITE_TTL_DAYS = 7;
const MEMBERS_LIST_LIMIT = 500;

/** Rang de tri par badge principal : admin, coach, joueur, puis membre. */
export function memberBadgeRank(member: MemberBadgeSource): number {
  return MEMBER_BADGES.indexOf(primaryBadge(member));
}

/** True si le membre a un code d’invitation encore valide (pending + non expiré). */
export function isMemberInviteValid(member: {
  pendingInviteCode: string | null;
  pendingInviteExpiresAt: Date | string | null;
}): boolean {
  if (!member.pendingInviteCode) return false;
  if (!member.pendingInviteExpiresAt) return true;
  const expiresAt =
    member.pendingInviteExpiresAt instanceof Date
      ? member.pendingInviteExpiresAt
      : new Date(member.pendingInviteExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() >= Date.now();
}

/**
 * Normalise un e-mail d’invitation (trim + lowercase) et vérifie qu’il est
 * présent et valide. L’e-mail est obligatoire : une invitation ne peut être
 * acceptée que par l’adresse invitée.
 */
export function normalizeRequiredInviteEmail(raw: string | undefined): string {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (!normalized) {
    throw new Error(
      "L’e-mail est obligatoire : l’invitation ne peut être acceptée que par l’adresse invitée.",
    );
  }
  const formatError = validateEmail(normalized);
  if (formatError) {
    throw new Error(`E-mail invalide (« ${normalized} »). ${formatError}`);
  }
  return normalized;
}

/** Génère un code d’invitation alphanumérique (6 car., uppercase). */
export function generateInviteCode(length = INVITE_CODE_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += INVITE_CODE_CHARS[bytes[index]! % INVITE_CODE_CHARS.length];
  }
  return code;
}

/** URL web absolue pour rejoindre avec un code (mailto / SMS). */
export function inviteJoinUrl(code: string): string {
  const base = site.url.replace(/\/$/, "");
  return `${base}${webJoinRedirectPath(code)}`;
}

/** Message FR prêt à copier pour WhatsApp / SMS / e-mail (voix Guy, aligné app). */
export function buildInviteMessage(params: {
  clubName: string;
  code: string;
}): string {
  return joinCopy.clubInviteMessage({
    clubName: params.clubName,
    code: params.code,
    joinUrl: inviteJoinUrl(params.code),
    appStoreUrl: appStoreLink("invite_share"),
    playStoreUrl: playStoreLink("invite_share"),
    siteUrl: site.url,
  });
}

function membersCol(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.members,
  );
}

function invitationsCol(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.invitations,
  );
}

function clubRef(clubId: string): DocumentReference {
  return doc(getAppFirestore(), Collections.clubs, clubId);
}

function sortKeyFirstName(member: ClubMemberRecord): string {
  const first = member.firstName.trim();
  if (first) return first.toLowerCase();
  const parts = member.displayName.trim().split(/\s+/);
  if (parts[0]) return parts[0].toLowerCase();
  return member.displayName.toLowerCase();
}

function parseLicense(data: Record<string, unknown>): string {
  const playerInfo = data[Fields.playerInfo];
  if (!playerInfo || typeof playerInfo !== "object") return "";
  const license = (playerInfo as Record<string, unknown>)[Fields.license];
  return typeof license === "string" ? license.trim() : "";
}

function parseTeamIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

/** Parse un document members/{memberId} (sans enrichissement). */
export function parseClubMember(
  id: string,
  data: Record<string, unknown>,
): ClubMemberRecord {
  const snapshot =
    (data[Fields.snapshot] as Record<string, unknown> | undefined) ?? {};
  const firstName = String(data[Fields.firstName] ?? "").trim();
  const lastName = String(data[Fields.lastName] ?? "").trim();
  const snapshotName = String(snapshot[Fields.displayName] ?? "").trim();
  const displayName =
    snapshotName ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    String(data[Fields.displayName] ?? "").trim();

  return {
    memberId: id,
    permissions: parsePermissions(data[Fields.permissions]),
    coachTeamIds: parseTeamIds(data[Fields.coachTeamIds]),
    status: String(data[Fields.status] ?? "active"),
    firstName,
    lastName,
    displayName: displayName || "Membre",
    accountUid: linkedAccountUid(data),
    email:
      typeof snapshot[Fields.email] === "string"
        ? String(snapshot[Fields.email]).trim() || null
        : null,
    avatarUrl:
      typeof snapshot[Fields.avatarUrl] === "string"
        ? String(snapshot[Fields.avatarUrl]).trim() || null
        : null,
    teamIds: parseTeamIds(data[Fields.teamIds]),
    license: parseLicense(data),
    activeInvitationId:
      typeof data[Fields.activeInvitationId] === "string"
        ? String(data[Fields.activeInvitationId])
        : null,
    pendingInviteCode: null,
    pendingInviteExpiresAt: null,
    hasLinkedAccount: false,
    joinedAt: toDate(data[Fields.joinedAt]),
  };
}

/** Charge une fiche membre par id. */
export async function getClubMember(
  clubId: string,
  memberId: string,
): Promise<ClubMemberRecord | null> {
  const snap = await getDoc(doc(membersCol(clubId), memberId));
  if (!snap.exists()) return null;
  return parseClubMember(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Charge des fiches membres par id (= uid quand la fiche est liée).
 * Un getDoc par id — adapté aux parents (pas de `list` sur `members`).
 * Les docs absents / refusés sont ignorés.
 */
export async function loadMembersByIds(
  clubId: string,
  memberIds: string[],
): Promise<ClubMemberRecord[]> {
  const uniqueIds = [...new Set(memberIds.map(String).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const byMemberId = new Map<string, ClubMemberRecord>();

  await Promise.all(
    uniqueIds.map(async (memberId) => {
      try {
        const member = await getClubMember(clubId, memberId);
        if (member) byMemberId.set(member.memberId, member);
      } catch {
        // Doc non lisible pour ce compte : on ignore.
      }
    }),
  );

  return [...byMemberId.values()].sort((a, b) => {
    const badgeCmp = memberBadgeRank(a) - memberBadgeRank(b);
    if (badgeCmp !== 0) return badgeCmp;
    return sortKeyFirstName(a).localeCompare(sortKeyFirstName(b), "fr");
  });
}

/** Complète nom / avatar / e-mail depuis `users/{uid}` (repli si snapshot incomplet). */
async function enrichFromUserProfile(
  member: ClubMemberRecord,
): Promise<ClubMemberRecord> {
  if (!member.accountUid) return member;
  try {
    const userSnap = await getDoc(
      doc(getAppFirestore(), Collections.users, member.accountUid),
    );
    if (!userSnap.exists()) return member;
    const userData = userSnap.data() as Record<string, unknown>;
    return {
      ...member,
      displayName:
        member.displayName ||
        String(userData[Fields.displayName] ?? "").trim() ||
        member.displayName,
      avatarUrl:
        member.avatarUrl ??
        (typeof userData[Fields.avatarUrl] === "string"
          ? String(userData[Fields.avatarUrl])
          : null),
      email:
        member.email ??
        (typeof userData[Fields.email] === "string"
          ? String(userData[Fields.email])
          : null),
    };
  } catch {
    // Profil user illisible : on garde la fiche membre seule.
    return member;
  }
}

/**
 * Invitations en attente du club, indexées par id (une seule requête).
 * Joueur / tiers : liste refusée par les rules → map vide.
 */
async function loadPendingInvitationsById(
  clubId: string,
): Promise<Map<string, Record<string, unknown>>> {
  try {
    const snap = await getDocs(
      query(
        invitationsCol(clubId),
        where(Fields.status, "==", InvitationStatus.pending),
      ),
    );
    return new Map(
      snap.docs.map((docSnap) => [
        docSnap.id,
        docSnap.data() as Record<string, unknown>,
      ]),
    );
  } catch {
    return new Map();
  }
}

/**
 * Enrichit les fiches membres sans lecture par membre : compte lié déduit
 * d’`accountUid` (retiré à la suppression de compte), nom / avatar / e-mail
 * depuis le snapshot, invitations jointes en mémoire. `users/{uid}` n’est lu
 * qu’en repli pour les fiches liées dont le snapshot n’a pas d’e-mail.
 */
async function enrichMembers(
  clubId: string,
  members: ClubMemberRecord[],
): Promise<ClubMemberRecord[]> {
  const needsInvitations = members.some((member) => member.activeInvitationId);
  const invitationsById = needsInvitations
    ? await loadPendingInvitationsById(clubId)
    : new Map<string, Record<string, unknown>>();

  return Promise.all(
    members.map(async (member) => {
      let enriched: ClubMemberRecord = {
        ...member,
        hasLinkedAccount: Boolean(member.accountUid),
      };
      const invite = member.activeInvitationId
        ? invitationsById.get(member.activeInvitationId)
        : undefined;
      if (invite) {
        enriched = {
          ...enriched,
          pendingInviteCode: String(invite[Fields.code] ?? "") || null,
          pendingInviteExpiresAt: toDate(invite[Fields.expiresAt]),
        };
      }
      // Snapshot écrit à l’acceptation : sans e-mail, il est incomplet.
      return enriched.accountUid && !enriched.email
        ? enrichFromUserProfile(enriched)
        : enriched;
    }),
  );
}

/**
 * Liste les membres du club (enrichis invitation + compte lié).
 * Tri : badge principal (Admin > Entraîneur > Joueur > Membre) puis prénom A→Z.
 */
export async function listClubMembers(
  clubId: string,
): Promise<ClubMemberRecord[]> {
  const snap = await getDocs(query(membersCol(clubId), limit(MEMBERS_LIST_LIMIT)));
  const members = await enrichMembers(
    clubId,
    snap.docs.map((docSnap) =>
      parseClubMember(docSnap.id, docSnap.data() as Record<string, unknown>),
    ),
  );

  members.sort((a, b) => {
    const badgeCmp = memberBadgeRank(a) - memberBadgeRank(b);
    if (badgeCmp !== 0) return badgeCmp;
    return sortKeyFirstName(a).localeCompare(sortKeyFirstName(b), "fr");
  });

  return members;
}

/**
 * Ajoute un membre pré-créé + invitation pending (miroir Flutter).
 * Fiche sans droit ni équipe : droits et équipes se posent ensuite (Functions).
 * L’e-mail est obligatoire : il est normalisé (trim + lowercase) et écrit sur
 * `invitations/{id}.email` ET `members.snapshot.email`.
 */
export async function addMemberWithInvitation(params: {
  clubId: string;
  firstName: string;
  lastName: string;
  sentByUid: string;
  club: Pick<ClubRecord, "name" | "sport">;
  /** E-mail de l’invité (obligatoire, seul ce compte pourra accepter). */
  email: string;
  /** false pour import CSV (log agrégé côté appelant). */
  logActivity?: boolean;
}): Promise<AddMemberResult> {
  const trimmedFirst = formatFirstName(params.firstName);
  const trimmedLast = formatLastName(params.lastName);
  const trimmedEmail = normalizeRequiredInviteEmail(params.email);

  const db = getAppFirestore();
  const memberRef = doc(membersCol(params.clubId));
  const inviteRef = doc(invitationsCol(params.clubId));
  const clubDocument = clubRef(params.clubId);
  const code = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
  const displayName = `${trimmedFirst} ${trimmedLast}`;

  await runTransaction(db, async (tx) => {
    const clubSnap = await tx.get(clubDocument);
    const memberCount =
      Number(clubSnap.data()?.[Fields.memberCount] ?? 0) || 0;

    const snapshot: Record<string, unknown> = {
      [Fields.displayName]: displayName,
      [Fields.email]: trimmedEmail,
    };

    const memberPayload: Record<string, unknown> = {
      [Fields.status]: "active",
      [Fields.playerInfo]: { [Fields.license]: "" },
      [Fields.firstName]: trimmedFirst,
      [Fields.lastName]: trimmedLast,
      [Fields.snapshot]: snapshot,
      [Fields.activeInvitationId]: inviteRef.id,
      [Fields.joinedAt]: serverTimestamp(),
      [Fields.updatedAt]: serverTimestamp(),
    };

    tx.set(memberRef, memberPayload);

    tx.set(inviteRef, {
      [Fields.code]: code,
      [Fields.type]: InvitationTypes.member,
      [Fields.status]: InvitationStatus.pending,
      [Fields.email]: trimmedEmail,
      [Fields.memberId]: memberRef.id,
      [Fields.sentBy]: params.sentByUid,
      [Fields.sentAt]: serverTimestamp(),
      [Fields.expiresAt]: Timestamp.fromDate(expiresAt),
      [Fields.clubName]: params.club.name,
      [Fields.clubSport]: params.club.sport,
      [Fields.firstName]: trimmedFirst,
      [Fields.lastName]: trimmedLast,
    });

    tx.update(clubDocument, {
      [Fields.memberCount]: memberCount + 1,
      [Fields.updatedAt]: serverTimestamp(),
    });

    if (params.logActivity !== false) {
      appendClubActivityToTransaction(tx, params.clubId, {
        type: ClubActivityTypes.membersAdded,
        actorUid: params.sentByUid,
        count: 1,
        summary: displayName,
        entityIds: [memberRef.id],
      });
    }
  });

  const member: ClubMemberRecord = {
    memberId: memberRef.id,
    permissions: [],
    coachTeamIds: [],
    status: "active",
    firstName: trimmedFirst,
    lastName: trimmedLast,
    displayName,
    accountUid: null,
    email: trimmedEmail,
    avatarUrl: null,
    teamIds: [],
    license: "",
    activeInvitationId: inviteRef.id,
    pendingInviteCode: code,
    pendingInviteExpiresAt: expiresAt,
    hasLinkedAccount: false,
    joinedAt: new Date(),
  };

  const invitation: ClubInvitationRecord = {
    id: inviteRef.id,
    clubId: params.clubId,
    code,
    status: InvitationStatus.pending,
    memberId: memberRef.id,
    sentBy: params.sentByUid,
    expiresAt,
    clubName: params.club.name,
    clubSport: params.club.sport,
    firstName: trimmedFirst,
    lastName: trimmedLast,
  };

  return { member, invitation };
}

/**
 * Crée une fiche membre sans invitation (import roster / invite plus tard).
 * E-mail optionnel : stocké dans `snapshot` pour `sendMemberInvites` depuis Activation.
 */
export async function addMemberWithoutInvitation(params: {
  clubId: string;
  firstName: string;
  lastName: string;
  sentByUid: string;
  /** E-mail à conserver sans créer d’invitation (normalisé si fourni). */
  email?: string;
  /** false pour import CSV (log agrégé côté appelant). */
  logActivity?: boolean;
}): Promise<ClubMemberRecord> {
  const trimmedFirst = formatFirstName(params.firstName);
  const trimmedLast = formatLastName(params.lastName);
  const trimmedEmail = params.email?.trim()
    ? normalizeRequiredInviteEmail(params.email)
    : null;

  const db = getAppFirestore();
  const memberRef = doc(membersCol(params.clubId));
  const clubDocument = clubRef(params.clubId);
  const displayName = `${trimmedFirst} ${trimmedLast}`;

  await runTransaction(db, async (tx) => {
    const clubSnap = await tx.get(clubDocument);
    const memberCount =
      Number(clubSnap.data()?.[Fields.memberCount] ?? 0) || 0;

    const snapshot: Record<string, unknown> = {
      [Fields.displayName]: displayName,
    };
    if (trimmedEmail) {
      snapshot[Fields.email] = trimmedEmail;
    }

    const memberPayload: Record<string, unknown> = {
      [Fields.status]: "active",
      [Fields.playerInfo]: { [Fields.license]: "" },
      [Fields.firstName]: trimmedFirst,
      [Fields.lastName]: trimmedLast,
      [Fields.snapshot]: snapshot,
      [Fields.joinedAt]: serverTimestamp(),
      [Fields.updatedAt]: serverTimestamp(),
    };

    tx.set(memberRef, memberPayload);

    tx.update(clubDocument, {
      [Fields.memberCount]: memberCount + 1,
      [Fields.updatedAt]: serverTimestamp(),
    });

    if (params.logActivity !== false) {
      appendClubActivityToTransaction(tx, params.clubId, {
        type: ClubActivityTypes.membersAdded,
        actorUid: params.sentByUid,
        count: 1,
        summary: displayName,
        entityIds: [memberRef.id],
      });
    }
  });

  return {
    memberId: memberRef.id,
    permissions: [],
    coachTeamIds: [],
    status: "active",
    firstName: trimmedFirst,
    lastName: trimmedLast,
    displayName,
    accountUid: null,
    email: trimmedEmail,
    avatarUrl: null,
    teamIds: [],
    license: "",
    activeInvitationId: null,
    pendingInviteCode: null,
    pendingInviteExpiresAt: null,
    hasLinkedAccount: false,
    joinedAt: new Date(),
  };
}

/**
 * Prolonge une invitation pending : remet expiresAt à aujourd’hui + INVITE_TTL_DAYS.
 * Refusé si le membre a déjà un compte lié.
 */
export async function extendMemberInvitation(params: {
  clubId: string;
  memberId: string;
}): Promise<{ code: string; expiresAt: Date }> {
  const { clubId, memberId } = params;
  const db = getAppFirestore();
  const memberDocument = doc(membersCol(clubId), memberId);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  return runTransaction(db, async (tx) => {
    const memberSnap = await tx.get(memberDocument);
    if (!memberSnap.exists()) {
      throw new Error("Membre introuvable.");
    }

    const memberData = memberSnap.data() as Record<string, unknown>;
    if (linkedAccountUid(memberData)) {
      throw new Error("Ce membre a déjà un compte lié.");
    }

    const inviteId =
      typeof memberData[Fields.activeInvitationId] === "string"
        ? String(memberData[Fields.activeInvitationId])
        : "";
    if (!inviteId) {
      throw new Error("Aucune invitation active à prolonger.");
    }

    const inviteDocument = doc(invitationsCol(clubId), inviteId);
    const inviteSnap = await tx.get(inviteDocument);
    if (!inviteSnap.exists()) {
      throw new Error("Invitation introuvable.");
    }

    const inviteData = inviteSnap.data() as Record<string, unknown>;
    if (String(inviteData[Fields.status] ?? "") !== InvitationStatus.pending) {
      throw new Error("L’invitation n’est plus en attente.");
    }

    const code = String(inviteData[Fields.code] ?? "").trim();
    if (!code) {
      throw new Error("Code d’invitation manquant.");
    }

    tx.update(inviteDocument, {
      [Fields.expiresAt]: Timestamp.fromDate(expiresAt),
      [Fields.updatedAt]: serverTimestamp(),
    });
    tx.update(memberDocument, {
      [Fields.updatedAt]: serverTimestamp(),
    });

    return { code, expiresAt };
  });
}

/**
 * Régénère (ou crée) une invitation : expire l’ancienne pending si présente,
 * crée un nouveau code valable INVITE_TTL_DAYS. Refusé si compte déjà lié.
 */
export async function regenerateMemberInvitation(params: {
  clubId: string;
  memberId: string;
  sentByUid: string;
  club: Pick<ClubRecord, "name" | "sport">;
}): Promise<{ code: string; expiresAt: Date }> {
  const { clubId, memberId, sentByUid, club } = params;
  const db = getAppFirestore();
  const memberDocument = doc(membersCol(clubId), memberId);
  const newInviteRef = doc(invitationsCol(clubId));
  const code = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  await runTransaction(db, async (tx) => {
    const memberSnap = await tx.get(memberDocument);
    if (!memberSnap.exists()) {
      throw new Error("Membre introuvable.");
    }

    const memberData = memberSnap.data() as Record<string, unknown>;
    if (linkedAccountUid(memberData)) {
      throw new Error("Ce membre a déjà un compte lié.");
    }

    const firstName = String(memberData[Fields.firstName] ?? "").trim();
    const lastName = String(memberData[Fields.lastName] ?? "").trim();
    const snapshot =
      (memberData[Fields.snapshot] as Record<string, unknown> | undefined) ?? {};
    const displayName =
      String(snapshot[Fields.displayName] ?? "").trim() ||
      [firstName, lastName].filter(Boolean).join(" ");
    const snapshotEmail = String(snapshot[Fields.email] ?? "")
      .trim()
      .toLowerCase();
    if (!snapshotEmail) {
      throw new Error(
        "Ajoutez un e-mail à ce membre avant de régénérer son invitation : seule l’adresse invitée pourra l’accepter.",
      );
    }

    const previousInviteId =
      typeof memberData[Fields.activeInvitationId] === "string"
        ? String(memberData[Fields.activeInvitationId])
        : null;

    const previousInviteDocument = previousInviteId
      ? doc(invitationsCol(clubId), previousInviteId)
      : null;
    const previousInviteSnap = previousInviteDocument
      ? await tx.get(previousInviteDocument)
      : null;

    if (
      previousInviteDocument &&
      previousInviteSnap?.exists() &&
      String(previousInviteSnap.data()?.[Fields.status] ?? "") ===
        InvitationStatus.pending
    ) {
      tx.update(previousInviteDocument, {
        [Fields.status]: InvitationStatus.expired,
        [Fields.updatedAt]: serverTimestamp(),
      });
    }

    tx.set(newInviteRef, {
      [Fields.code]: code,
      [Fields.type]: InvitationTypes.member,
      [Fields.status]: InvitationStatus.pending,
      [Fields.email]: snapshotEmail,
      [Fields.memberId]: memberId,
      [Fields.sentBy]: sentByUid,
      [Fields.sentAt]: serverTimestamp(),
      [Fields.expiresAt]: Timestamp.fromDate(expiresAt),
      [Fields.clubName]: club.name,
      [Fields.clubSport]: club.sport,
      [Fields.firstName]: firstName || displayName,
      [Fields.lastName]: lastName,
    });

    tx.update(memberDocument, {
      [Fields.activeInvitationId]: newInviteRef.id,
      [Fields.updatedAt]: serverTimestamp(),
    });
  });

  return { code, expiresAt };
}

/**
 * Remplace les droits d’un membre via la callable `setMemberPermissions`
 * (droit Administrateur exigé, garde « dernier admin » et index
 * `club.adminIds` côté serveur). Retourne la liste normalisée.
 */
export async function updateMemberPermissions(params: {
  clubId: string;
  memberId: string;
  permissions: readonly ClubPermission[];
}): Promise<ClubPermission[]> {
  try {
    const result = await setMemberPermissionsCallable({
      clubId: params.clubId,
      memberId: params.memberId,
      permissions: normalizePermissions(params.permissions),
    });
    return parsePermissions(result.permissions);
  } catch (error) {
    if (isLastAdminError(error)) throw new Error(permissionsCopy.lastAdmin);
    throw error;
  }
}

/**
 * Vrai si la callable a refusé de retirer le dernier administrateur
 * (`failed-precondition` de `functions/src/memberAdmin.ts`, `details.reason`
 * `last-admin`).
 */
export function isLastAdminError(error: unknown): boolean {
  return error instanceof CallableError && error.reason === "last-admin";
}

/**
 * Retire un membre du club via la callable `removeMember`.
 * Le serveur refuse de retirer le dernier admin, supprime la fiche,
 * décrémente `memberCount`, retire des équipes, révoque
 * l’invitation pending et nettoie `users/{uid}.memberClubIds`.
 */
export async function removeMember(params: {
  clubId: string;
  memberId: string;
}): Promise<void> {
  await removeMemberCallable(params);
}

/** Met à jour `playerInfo.license` (crée playerInfo si absent). */
export async function updateMemberLicense(params: {
  clubId: string;
  memberId: string;
  license: string;
}): Promise<void> {
  const memberDocument = doc(membersCol(params.clubId), params.memberId);
  const snap = await getDoc(memberDocument);
  if (!snap.exists()) {
    throw new Error("Membre introuvable.");
  }

  const data = snap.data() as Record<string, unknown>;
  const existingInfo =
    data[Fields.playerInfo] && typeof data[Fields.playerInfo] === "object"
      ? { ...(data[Fields.playerInfo] as Record<string, unknown>) }
      : {};

  await updateDoc(memberDocument, {
    [Fields.playerInfo]: {
      ...existingInfo,
      [Fields.license]: formatLicense(params.license),
    },
    [Fields.updatedAt]: serverTimestamp(),
  });
}

/**
 * Met à jour prénom / nom d’un membre pas encore inscrit, sans toucher à l’e-mail.
 * Utile à l’import CSV quand la cellule e-mail est vide (on ne vide pas l’existant).
 */
export async function updatePendingMemberNames(params: {
  clubId: string;
  memberId: string;
  firstName: string;
  lastName: string;
}): Promise<void> {
  const trimmedFirst = formatFirstName(params.firstName);
  const trimmedLast = formatLastName(params.lastName);

  const db = getAppFirestore();
  const memberDocument = doc(membersCol(params.clubId), params.memberId);

  await runTransaction(db, async (tx) => {
    const memberSnap = await tx.get(memberDocument);
    if (!memberSnap.exists()) {
      throw new Error("Membre introuvable.");
    }
    const data = memberSnap.data() as Record<string, unknown>;
    if (linkedAccountUid(data)) {
      throw new Error(
        "Impossible de modifier l’identité d’un membre déjà inscrit.",
      );
    }

    const activeInvitationId = String(
      data[Fields.activeInvitationId] ?? "",
    ).trim();
    const inviteDocument = activeInvitationId
      ? doc(invitationsCol(params.clubId), activeInvitationId)
      : null;
    const inviteSnap = inviteDocument ? await tx.get(inviteDocument) : null;

    const existingSnapshot =
      data[Fields.snapshot] && typeof data[Fields.snapshot] === "object"
        ? { ...(data[Fields.snapshot] as Record<string, unknown>) }
        : {};
    const displayName = `${trimmedFirst} ${trimmedLast}`;
    const nextSnapshot: Record<string, unknown> = {
      ...existingSnapshot,
      [Fields.displayName]: displayName,
    };

    tx.update(memberDocument, {
      [Fields.firstName]: trimmedFirst,
      [Fields.lastName]: trimmedLast,
      [Fields.snapshot]: nextSnapshot,
      [Fields.updatedAt]: serverTimestamp(),
    });

    if (inviteDocument && inviteSnap?.exists()) {
      tx.update(inviteDocument, {
        [Fields.firstName]: trimmedFirst,
        [Fields.lastName]: trimmedLast,
        [Fields.updatedAt]: serverTimestamp(),
      });
    }
  });
}

/**
 * Met à jour prénom / nom / e-mail d’un membre pas encore inscrit.
 * L’e-mail est obligatoire ici (normalisé) car on prépare l’invitation :
 * seule cette adresse pourra accepter. Synchronisé sur l’invitation active
 * s’il en existe une.
 */
export async function updatePendingMemberProfile(params: {
  clubId: string;
  memberId: string;
  firstName: string;
  lastName: string;
  email: string;
}): Promise<void> {
  const trimmedFirst = formatFirstName(params.firstName);
  const trimmedLast = formatLastName(params.lastName);
  const trimmedEmail = normalizeRequiredInviteEmail(params.email);

  const db = getAppFirestore();
  const memberDocument = doc(membersCol(params.clubId), params.memberId);

  await runTransaction(db, async (tx) => {
    const memberSnap = await tx.get(memberDocument);
    if (!memberSnap.exists()) {
      throw new Error("Membre introuvable.");
    }
    const data = memberSnap.data() as Record<string, unknown>;
    if (linkedAccountUid(data)) {
      throw new Error(
        "Impossible de modifier l’identité d’un membre déjà inscrit.",
      );
    }

    const activeInvitationId = String(
      data[Fields.activeInvitationId] ?? "",
    ).trim();
    const inviteDocument = activeInvitationId
      ? doc(invitationsCol(params.clubId), activeInvitationId)
      : null;
    const inviteSnap = inviteDocument ? await tx.get(inviteDocument) : null;

    const existingSnapshot =
      data[Fields.snapshot] && typeof data[Fields.snapshot] === "object"
        ? { ...(data[Fields.snapshot] as Record<string, unknown>) }
        : {};
    const displayName = `${trimmedFirst} ${trimmedLast}`;
    const nextSnapshot: Record<string, unknown> = {
      ...existingSnapshot,
      [Fields.displayName]: displayName,
      [Fields.email]: trimmedEmail,
    };

    tx.update(memberDocument, {
      [Fields.firstName]: trimmedFirst,
      [Fields.lastName]: trimmedLast,
      [Fields.snapshot]: nextSnapshot,
      [Fields.updatedAt]: serverTimestamp(),
    });

    if (inviteDocument && inviteSnap?.exists()) {
      tx.update(inviteDocument, {
        [Fields.firstName]: trimmedFirst,
        [Fields.lastName]: trimmedLast,
        [Fields.email]: trimmedEmail,
        [Fields.updatedAt]: serverTimestamp(),
      });
    }
  });
}

