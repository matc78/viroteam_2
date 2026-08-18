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
  type DocumentReference,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import type { ClubRecord } from "./clubService";
import {
  Collections,
  Fields,
  InvitationStatus,
  MemberRoles,
} from "./constants";
import { toDate } from "./types";

/** Rôle club (aligné MemberRoles Flutter). */
export type ClubMemberRole =
  (typeof MemberRoles)[keyof typeof MemberRoles];

/** Membre club enrichi pour le portail. */
export type ClubMemberRecord = {
  memberId: string;
  role: ClubMemberRole;
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
  role: string;
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

/** Niveau hiérarchique rôle (admin > coach > player). */
export function memberRoleLevel(role: string): number {
  if (role === MemberRoles.admin) return 3;
  if (role === MemberRoles.coach) return 2;
  if (role === MemberRoles.player) return 1;
  return 0;
}

/** Libellé FR d’un rôle membre. */
export function memberRoleLabel(role: string): string {
  if (role === MemberRoles.admin) return "Admin";
  if (role === MemberRoles.coach) return "Coach";
  if (role === MemberRoles.player) return "Joueur";
  return role;
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

/** Message FR prêt à copier pour WhatsApp / SMS (aligné app). */
export function buildInviteMessage(params: {
  clubName: string;
  code: string;
}): string {
  return `Rejoins ${params.clubName} sur ViroTeam !
Ton code : ${params.code}
Valable 7 jours.
Ouvre l'app → « J'ai un code d'invitation » et saisis ce code.`;
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

function normalizeRole(raw: string): ClubMemberRole {
  if (
    raw === MemberRoles.admin ||
    raw === MemberRoles.coach ||
    raw === MemberRoles.player
  ) {
    return raw;
  }
  return MemberRoles.player;
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

  const legacyUserId = String(data[Fields.userId] ?? "").trim();
  const accountUidRaw = String(data[Fields.accountUid] ?? "").trim();
  const accountUid =
    accountUidRaw || (legacyUserId ? legacyUserId : null);

  return {
    memberId: String(data[Fields.memberId] ?? id),
    role: normalizeRole(String(data[Fields.role] ?? MemberRoles.player)),
    status: String(data[Fields.status] ?? "active"),
    firstName,
    lastName,
    displayName: displayName || "Membre",
    accountUid,
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

/** Résout la fiche licencié liée au compte Auth (Moi). */
export async function getLinkedMemberId(
  clubId: string,
  accountUid: string,
): Promise<string | null> {
  const indexSnap = await getDoc(
    doc(
      getAppFirestore(),
      Collections.clubs,
      clubId,
      Collections.memberAccounts,
      accountUid,
    ),
  );
  if (indexSnap.exists()) {
    const linked = String(indexSnap.data()?.[Fields.memberId] ?? "").trim();
    if (linked) return linked;
  }
  const selfSnap = await getDoc(doc(membersCol(clubId), accountUid));
  if (selfSnap.exists()) return accountUid;
  return null;
}

async function enrichMember(
  clubId: string,
  member: ClubMemberRecord,
): Promise<ClubMemberRecord> {
  let enriched = { ...member };

  if (member.accountUid) {
    const userSnap = await getDoc(
      doc(getAppFirestore(), Collections.users, member.accountUid),
    );
    if (userSnap.exists()) {
      const userData = userSnap.data() as Record<string, unknown>;
      enriched = {
        ...enriched,
        hasLinkedAccount: true,
        displayName:
          enriched.displayName ||
          String(userData[Fields.displayName] ?? "").trim() ||
          enriched.displayName,
        avatarUrl:
          enriched.avatarUrl ??
          (typeof userData[Fields.avatarUrl] === "string"
            ? String(userData[Fields.avatarUrl])
            : null),
        email:
          enriched.email ??
          (typeof userData[Fields.email] === "string"
            ? String(userData[Fields.email])
            : null),
      };
    }
  }

  if (member.activeInvitationId) {
    const inviteSnap = await getDoc(
      doc(invitationsCol(clubId), member.activeInvitationId),
    );
    if (inviteSnap.exists()) {
      const inviteData = inviteSnap.data() as Record<string, unknown>;
      if (String(inviteData[Fields.status] ?? "") === InvitationStatus.pending) {
        enriched = {
          ...enriched,
          pendingInviteCode: String(inviteData[Fields.code] ?? "") || null,
          pendingInviteExpiresAt: toDate(inviteData[Fields.expiresAt]),
        };
      }
    }
  }

  return enriched;
}

/**
 * Liste les membres du club (enrichis invitation + compte lié).
 * Tri : rôle desc puis prénom A→Z.
 */
export async function listClubMembers(
  clubId: string,
): Promise<ClubMemberRecord[]> {
  const snap = await getDocs(query(membersCol(clubId), limit(MEMBERS_LIST_LIMIT)));
  const members = await Promise.all(
    snap.docs.map(async (docSnap) => {
      const parsed = parseClubMember(
        docSnap.id,
        docSnap.data() as Record<string, unknown>,
      );
      return enrichMember(clubId, parsed);
    }),
  );

  members.sort((a, b) => {
    const roleCmp = memberRoleLevel(b.role) - memberRoleLevel(a.role);
    if (roleCmp !== 0) return roleCmp;
    return sortKeyFirstName(a).localeCompare(sortKeyFirstName(b), "fr");
  });

  return members;
}

/**
 * Ajoute un membre pré-créé + invitation pending (miroir Flutter).
 * Rôles autorisés : joueur ou coach.
 */
export async function addMemberWithInvitation(params: {
  clubId: string;
  firstName: string;
  lastName: string;
  role: typeof MemberRoles.player | typeof MemberRoles.coach;
  sentByUid: string;
  club: Pick<ClubRecord, "name" | "sport">;
  /** Email optionnel stocké dans `snapshot.email` (import CSV). */
  email?: string;
}): Promise<AddMemberResult> {
  const trimmedFirst = params.firstName.trim();
  const trimmedLast = params.lastName.trim();
  const trimmedEmail = params.email?.trim() ?? "";
  if (!trimmedFirst || !trimmedLast) {
    throw new Error("Le prénom et le nom sont obligatoires.");
  }
  if (
    params.role !== MemberRoles.player &&
    params.role !== MemberRoles.coach
  ) {
    throw new Error("Seuls joueur et coach peuvent être ajoutés ici.");
  }

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
    };
    if (trimmedEmail) {
      snapshot[Fields.email] = trimmedEmail;
    }

    const memberPayload: Record<string, unknown> = {
      [Fields.memberId]: memberRef.id,
      [Fields.role]: params.role,
      [Fields.status]: "active",
      [Fields.firstName]: trimmedFirst,
      [Fields.lastName]: trimmedLast,
      [Fields.teamIds]: [],
      [Fields.snapshot]: snapshot,
      [Fields.activeInvitationId]: inviteRef.id,
      [Fields.joinedAt]: serverTimestamp(),
      [Fields.updatedAt]: serverTimestamp(),
    };

    if (params.role === MemberRoles.player) {
      memberPayload[Fields.playerInfo] = { [Fields.license]: "" };
    }
    if (params.role === MemberRoles.coach) {
      memberPayload[Fields.coachInfo] = { [Fields.headCoach]: false };
    }

    tx.set(memberRef, memberPayload);

    tx.set(inviteRef, {
      [Fields.code]: code,
      [Fields.role]: params.role,
      [Fields.status]: InvitationStatus.pending,
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
  });

  const member: ClubMemberRecord = {
    memberId: memberRef.id,
    role: params.role,
    status: "active",
    firstName: trimmedFirst,
    lastName: trimmedLast,
    displayName,
    accountUid: null,
    email: trimmedEmail || null,
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
    role: params.role,
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
    const accountUid = String(
      memberData[Fields.accountUid] ?? memberData[Fields.userId] ?? "",
    ).trim();
    if (accountUid) {
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
    const accountUid = String(
      memberData[Fields.accountUid] ?? memberData[Fields.userId] ?? "",
    ).trim();
    if (accountUid) {
      throw new Error("Ce membre a déjà un compte lié.");
    }

    const role = normalizeRole(String(memberData[Fields.role] ?? MemberRoles.player));
    const firstName = String(memberData[Fields.firstName] ?? "").trim();
    const lastName = String(memberData[Fields.lastName] ?? "").trim();
    const snapshot =
      (memberData[Fields.snapshot] as Record<string, unknown> | undefined) ?? {};
    const displayName =
      String(snapshot[Fields.displayName] ?? "").trim() ||
      [firstName, lastName].filter(Boolean).join(" ");

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
      [Fields.role]: role,
      [Fields.status]: InvitationStatus.pending,
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
 * Change le rôle d’un membre (garde dernier admin + sync adminIds / memberships).
 */
export async function updateMemberRole(params: {
  clubId: string;
  memberId: string;
  newRole: ClubMemberRole;
}): Promise<void> {
  const { clubId, memberId, newRole } = params;
  if (
    newRole !== MemberRoles.admin &&
    newRole !== MemberRoles.coach &&
    newRole !== MemberRoles.player
  ) {
    throw new Error("Rôle invalide.");
  }

  const db = getAppFirestore();
  const memberDocument = doc(membersCol(clubId), memberId);
  const clubDocument = clubRef(clubId);

  await runTransaction(db, async (tx) => {
    const memberSnap = await tx.get(memberDocument);
    const clubSnap = await tx.get(clubDocument);
    if (!memberSnap.exists()) {
      throw new Error("Membre introuvable.");
    }

    const data = memberSnap.data() as Record<string, unknown>;
    const oldRole = String(data[Fields.role] ?? MemberRoles.player);
    const accountUid =
      String(data[Fields.accountUid] ?? data[Fields.userId] ?? "").trim() ||
      null;

    const adminIdsRaw = clubSnap.data()?.[Fields.adminIds];
    const adminIds = Array.isArray(adminIdsRaw)
      ? adminIdsRaw.map(String)
      : [];

    if (
      oldRole === MemberRoles.admin &&
      newRole !== MemberRoles.admin
    ) {
      const adminKey = accountUid ?? memberId;
      if (adminIds.length <= 1 && adminIds.includes(adminKey)) {
        throw new Error(
          "Impossible de retirer le dernier administrateur.",
        );
      }
    }

    const userDocument = accountUid
      ? doc(db, Collections.users, accountUid)
      : null;
    const userSnap = userDocument ? await tx.get(userDocument) : null;

    tx.update(memberDocument, {
      [Fields.role]: newRole,
      [Fields.updatedAt]: serverTimestamp(),
    });

    let updatedAdminIds = [...adminIds];
    if (accountUid) {
      if (
        newRole === MemberRoles.admin &&
        !updatedAdminIds.includes(accountUid)
      ) {
        updatedAdminIds = [...updatedAdminIds, accountUid];
      } else if (
        oldRole === MemberRoles.admin &&
        newRole !== MemberRoles.admin
      ) {
        updatedAdminIds = updatedAdminIds.filter((id) => id !== accountUid);
      }

      if (
        updatedAdminIds.length !== adminIds.length ||
        updatedAdminIds.some((id, index) => id !== adminIds[index])
      ) {
        tx.update(clubDocument, {
          [Fields.adminIds]: updatedAdminIds,
          [Fields.updatedAt]: serverTimestamp(),
        });
      }

      if (userDocument && userSnap?.exists()) {
        const userData = userSnap.data() as Record<string, unknown>;
        const membershipsRaw = userData[Fields.clubMemberships];
        const memberships = Array.isArray(membershipsRaw)
          ? membershipsRaw
              .filter(
                (item): item is Record<string, unknown> =>
                  !!item && typeof item === "object",
              )
              .map((item) => ({ ...item }))
          : [];

        for (let index = 0; index < memberships.length; index += 1) {
          if (String(memberships[index]![Fields.clubId] ?? "") === clubId) {
            memberships[index] = {
              [Fields.clubId]: clubId,
              [Fields.role]: newRole,
            };
            break;
          }
        }

        tx.update(userDocument, {
          [Fields.clubMemberships]: memberships,
          [Fields.updatedAt]: serverTimestamp(),
        });
      }
    }
  });
}

/**
 * Supprime un membre (interdit pour admin). Expire l’invitation pending et nettoie l’index compte.
 */
export async function removeMember(params: {
  clubId: string;
  memberId: string;
}): Promise<void> {
  const { clubId, memberId } = params;
  const db = getAppFirestore();
  const memberDocument = doc(membersCol(clubId), memberId);
  const clubDocument = clubRef(clubId);

  await runTransaction(db, async (tx) => {
    const memberSnap = await tx.get(memberDocument);
    const clubSnap = await tx.get(clubDocument);
    if (!memberSnap.exists()) return;

    const data = memberSnap.data() as Record<string, unknown>;
    const role = String(data[Fields.role] ?? MemberRoles.player);
    if (role === MemberRoles.admin) {
      throw new Error("Impossible de supprimer un administrateur.");
    }

    const accountUid =
      String(data[Fields.accountUid] ?? data[Fields.userId] ?? "").trim() ||
      null;
    const inviteId =
      typeof data[Fields.activeInvitationId] === "string"
        ? String(data[Fields.activeInvitationId])
        : null;

    const inviteDocument = inviteId
      ? doc(invitationsCol(clubId), inviteId)
      : null;
    const inviteSnap = inviteDocument ? await tx.get(inviteDocument) : null;

    const userDocument = accountUid
      ? doc(db, Collections.users, accountUid)
      : null;
    const userSnap = userDocument ? await tx.get(userDocument) : null;

    const accountIndexRef = accountUid
      ? doc(collection(clubDocument, Collections.memberAccounts), accountUid)
      : null;
    const indexSnap = accountIndexRef ? await tx.get(accountIndexRef) : null;

    tx.delete(memberDocument);

    const memberCount = Number(clubSnap.data()?.[Fields.memberCount] ?? 0) || 0;
    tx.update(clubDocument, {
      [Fields.memberCount]: memberCount > 0 ? memberCount - 1 : 0,
      [Fields.updatedAt]: serverTimestamp(),
    });

    if (
      inviteDocument &&
      inviteSnap?.exists() &&
      String(inviteSnap.data()?.[Fields.status] ?? "") ===
        InvitationStatus.pending
    ) {
      tx.update(inviteDocument, {
        [Fields.status]: InvitationStatus.expired,
        [Fields.updatedAt]: serverTimestamp(),
      });
    }

    if (userDocument && userSnap?.exists()) {
      const userData = userSnap.data() as Record<string, unknown>;
      const membershipsRaw = userData[Fields.clubMemberships];
      const memberships = Array.isArray(membershipsRaw)
        ? membershipsRaw.filter(
            (item): item is Record<string, unknown> =>
              !!item &&
              typeof item === "object" &&
              String(item[Fields.clubId] ?? "") !== clubId,
          )
        : [];
      tx.update(userDocument, {
        [Fields.clubMemberships]: memberships,
        [Fields.updatedAt]: serverTimestamp(),
      });
    }

    if (accountIndexRef && indexSnap?.exists()) {
      tx.delete(accountIndexRef);
    }
  });
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
      [Fields.license]: params.license.trim(),
    },
    [Fields.updatedAt]: serverTimestamp(),
  });
}

/**
 * Rattache un membre à une équipe existante (playerIds ou coachIds).
 * Met aussi à jour `members.teamIds` pour cohérence d’affichage.
 */
export async function assignMemberToTeam(params: {
  clubId: string;
  memberId: string;
  teamId: string;
  role: typeof MemberRoles.player | typeof MemberRoles.coach;
}): Promise<void> {
  const db = getAppFirestore();
  const teamDocument = doc(
    collection(db, Collections.clubs, params.clubId, Collections.teams),
    params.teamId,
  );
  const memberDocument = doc(membersCol(params.clubId), params.memberId);

  await runTransaction(db, async (tx) => {
    const teamSnap = await tx.get(teamDocument);
    const memberSnap = await tx.get(memberDocument);
    if (!teamSnap.exists()) {
      throw new Error("Équipe introuvable.");
    }
    if (!memberSnap.exists()) {
      throw new Error("Membre introuvable.");
    }

    const teamData = teamSnap.data() as Record<string, unknown>;
    const field =
      params.role === MemberRoles.coach ? Fields.coachIds : Fields.playerIds;
    const currentIds = Array.isArray(teamData[field])
      ? teamData[field].map(String)
      : [];
    if (!currentIds.includes(params.memberId)) {
      tx.update(teamDocument, {
        [field]: [...currentIds, params.memberId],
        [Fields.updatedAt]: serverTimestamp(),
      });
    }

    const memberData = memberSnap.data() as Record<string, unknown>;
    const teamIds = parseTeamIds(memberData[Fields.teamIds]);
    if (!teamIds.includes(params.teamId)) {
      tx.update(memberDocument, {
        [Fields.teamIds]: [...teamIds, params.teamId],
        [Fields.updatedAt]: serverTimestamp(),
      });
    }
  });
}
