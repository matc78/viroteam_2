import {
  Collections,
  Fields,
  GuardianStatuses,
  InvitationStatus,
  InvitationTypes,
  MemberRoles,
} from "@/lib/firebase/constants";
import { getAppFirestore } from "@/lib/firebase/app";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { toDate } from "@/lib/firebase/types";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";
import { listClubMembers } from "@/lib/firebase/memberService";

/** Enfant lié à une ligne parent (vue admin). */
export type ParentChildRef = {
  memberId: string;
  displayName: string;
  invitationId: string | null;
  invitationCode: string | null;
  expiresAt: Date | null;
  inviteValid: boolean;
  parentUid: string | null;
  status: "active" | "pending";
};

/** Ligne agrégée : un parent (uid ou e-mail) ↔ N enfants. */
export type ClubParentRow = {
  rowKey: string;
  parentUid: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  status: "active" | "pending";
  children: ParentChildRef[];
  /** Fiche membre du parent s’il est aussi licencié du club. */
  rosterMemberId: string | null;
  /** Première invitation pending (actions globales). */
  primaryInvitationId: string | null;
  primaryInvitationCode: string | null;
  primaryExpiresAt: Date | null;
  primaryInviteValid: boolean;
};

/** Filtres liste parents. */
export type ParentsFilters = {
  search: string;
  status: "all" | "pending" | "active";
};

function guardiansCol(clubId: string, memberId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.members,
    memberId,
    Collections.guardians,
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

function memberDisplayName(member: ClubMemberRecord): string {
  return (
    member.displayName.trim() ||
    [member.firstName, member.lastName].filter(Boolean).join(" ") ||
    "Enfant"
  );
}

function parseUserName(user: Record<string, unknown>): {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
} {
  const firstName = String(user[Fields.firstName] ?? "").trim();
  const lastName = String(user[Fields.lastName] ?? "").trim();
  const displayName =
    String(user[Fields.displayName] ?? "").trim() ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    "";
  const email = String(user[Fields.email] ?? "").trim() || null;
  const avatarUrl = String(user[Fields.avatarUrl] ?? "").trim() || null;
  return { firstName, lastName, displayName, email, avatarUrl };
}

function inviteStillValid(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() >= Date.now();
}

/**
 * Charge les parents du club (guardians actifs/pending + invitations guardian).
 * Une ligne = un parent (uid ou e-mail) avec ses enfants.
 * Passe `members` pour éviter un second `listClubMembers`.
 */
export async function listClubParentRows(
  clubId: string,
  members?: ClubMemberRecord[],
): Promise<ClubParentRow[]> {
  const membersList = members ?? (await listClubMembers(clubId));
  const membersById = new Map(membersList.map((m) => [m.memberId, m]));
  const membersByAccount = new Map<string, ClubMemberRecord>();
  for (const member of membersList) {
    if (member.accountUid) {
      membersByAccount.set(member.accountUid, member);
    }
  }

  type AccChild = ParentChildRef & { aggregateKey: string };
  const byKey = new Map<
    string,
    {
      parentUid: string | null;
      email: string | null;
      firstName: string;
      lastName: string;
      displayName: string;
      children: AccChild[];
    }
  >();

  function ensureRow(
    key: string,
    seed: {
      parentUid: string | null;
      email: string | null;
      firstName?: string;
      lastName?: string;
      displayName?: string;
    },
  ) {
    let row = byKey.get(key);
    if (!row) {
      row = {
        parentUid: seed.parentUid,
        email: seed.email,
        firstName: seed.firstName ?? "",
        lastName: seed.lastName ?? "",
        displayName: seed.displayName ?? seed.email ?? "Parent",
        children: [],
      };
      byKey.set(key, row);
    } else {
      if (!row.parentUid && seed.parentUid) row.parentUid = seed.parentUid;
      if (!row.email && seed.email) row.email = seed.email;
      if (!row.displayName && seed.displayName) {
        row.displayName = seed.displayName;
      }
      if (!row.firstName && seed.firstName) row.firstName = seed.firstName;
      if (!row.lastName && seed.lastName) row.lastName = seed.lastName;
    }
    return row;
  }

  const pendingGuardianByMember = new Map<
    string,
    { id: string; data: Record<string, unknown> }
  >();
  try {
    const pendingInvitesSnap = await getDocs(
      query(
        invitationsCol(clubId),
        where(Fields.status, "==", InvitationStatus.pending),
      ),
    );
    for (const inviteDoc of pendingInvitesSnap.docs) {
      const data = inviteDoc.data() as Record<string, unknown>;
      if (String(data[Fields.type] ?? "") !== InvitationTypes.guardian) {
        continue;
      }
      const memberId = String(data[Fields.memberId] ?? "").trim();
      if (!memberId) continue;
      if (!pendingGuardianByMember.has(memberId)) {
        pendingGuardianByMember.set(memberId, { id: inviteDoc.id, data });
      }
    }
  } catch {
    // Invites illisibles : on continue avec les seuls guardians.
  }

  const guardianResults = await Promise.all(
    membersList.map(async (member) => {
      try {
        const snap = await getDocs(guardiansCol(clubId, member.memberId));
        return { member, snap };
      } catch {
        return { member, snap: null };
      }
    }),
  );

  const occupyingByMemberId = new Map<
    string,
    { id: string; data: Record<string, unknown> }
  >();
  const parentUids = new Set<string>();
  for (const { member, snap } of guardianResults) {
    if (!snap) continue;
    const occupying = snap.docs.find((guardianDoc) => {
      const status = String(guardianDoc.data()[Fields.status] ?? "");
      return (
        status === GuardianStatuses.active || status === GuardianStatuses.pending
      );
    });
    if (!occupying) continue;
    occupyingByMemberId.set(member.memberId, {
      id: occupying.id,
      data: occupying.data() as Record<string, unknown>,
    });
    parentUids.add(occupying.id);
  }

  const usersById = new Map<
    string,
    ReturnType<typeof parseUserName>
  >();
  await Promise.all(
    [...parentUids].map(async (uid) => {
      try {
        const userSnap = await getDoc(
          doc(getAppFirestore(), Collections.users, uid),
        );
        if (!userSnap.exists()) return;
        usersById.set(
          uid,
          parseUserName(userSnap.data() as Record<string, unknown>),
        );
      } catch {
        // Profil user illisible : on garde l’uid seul.
      }
    }),
  );

  for (const member of membersList) {
    const childName = memberDisplayName(member);
    const invitesForMember = pendingGuardianByMember.get(member.memberId);
    const pendingInvite = invitesForMember ?? null;
    const inviteData = pendingInvite?.data;
    const occupying = occupyingByMemberId.get(member.memberId);

    if (occupying) {
      const statusRaw = String(
        occupying.data[Fields.status] ?? GuardianStatuses.pending,
      );
      const status =
        statusRaw === GuardianStatuses.active ? "active" : "pending";
      const parsed = usersById.get(occupying.id);
      const firstName = parsed?.firstName ?? "";
      const lastName = parsed?.lastName ?? "";
      let displayName = parsed?.displayName || "";
      let email: string | null = parsed?.email ?? null;
      if (!displayName) displayName = "Parent";

      const expiresAt = inviteData
        ? toDate(inviteData[Fields.expiresAt])
        : null;
      if (!email && inviteData) {
        email = String(inviteData[Fields.email] ?? "").trim() || null;
      }

      const key = `uid:${occupying.id}`;
      const row = ensureRow(key, {
        parentUid: occupying.id,
        email,
        firstName,
        lastName,
        displayName: displayName || email || "Parent",
      });
      row.children.push({
        aggregateKey: key,
        memberId: member.memberId,
        displayName: childName,
        invitationId: pendingInvite?.id ?? null,
        invitationCode: inviteData
          ? String(inviteData[Fields.code] ?? "").trim() || null
          : null,
        expiresAt,
        inviteValid: status === "pending" ? inviteStillValid(expiresAt) : true,
        parentUid: occupying.id,
        status,
      });
      continue;
    }

    if (!pendingInvite || !inviteData) continue;

    const expiresAt = toDate(inviteData[Fields.expiresAt]);
    const email =
      String(inviteData[Fields.email] ?? "").trim().toLowerCase() || null;
    if (!email) continue;

    const key = `email:${email}`;
    const row = ensureRow(key, {
      parentUid: null,
      email,
      displayName: email,
    });
    row.children.push({
      aggregateKey: key,
      memberId: member.memberId,
      displayName: childName,
      invitationId: pendingInvite.id,
      invitationCode: String(inviteData[Fields.code] ?? "").trim() || null,
      expiresAt,
      inviteValid: inviteStillValid(expiresAt),
      parentUid: null,
      status: "pending",
    });
  }

  const rows: ClubParentRow[] = [];
  for (const [rowKey, acc] of byKey) {
    const hasActive = acc.children.some((c) => c.status === "active");
    const status: "active" | "pending" = hasActive ? "active" : "pending";
    const pendingChild =
      acc.children.find((c) => c.status === "pending" && c.invitationId) ??
      null;
    const rosterMember = acc.parentUid
      ? membersByAccount.get(acc.parentUid) ??
        membersById.get(acc.parentUid) ??
        null
      : null;

    rows.push({
      rowKey,
      parentUid: acc.parentUid,
      firstName: acc.firstName,
      lastName: acc.lastName,
      displayName: acc.displayName,
      email: acc.email,
      status,
      children: acc.children.map(({ aggregateKey: _k, ...child }) => child),
      rosterMemberId: rosterMember?.memberId ?? null,
      primaryInvitationId: pendingChild?.invitationId ?? null,
      primaryInvitationCode: pendingChild?.invitationCode ?? null,
      primaryExpiresAt: pendingChild?.expiresAt ?? null,
      primaryInviteValid: pendingChild
        ? pendingChild.inviteValid
        : status === "active",
    });
  }

  rows.sort((a, b) =>
    a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase(), "fr"),
  );
  return rows;
}

/** Filtre les lignes parents (recherche + statut). */
export function filterParentRows(
  rows: ClubParentRow[],
  filters: ParentsFilters,
): ClubParentRow[] {
  const needle = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.status !== "all" && row.status !== filters.status) {
      return false;
    }
    if (!needle) return true;
    const haystack = [
      row.displayName,
      row.firstName,
      row.lastName,
      row.email ?? "",
      ...row.children.map((c) => c.displayName),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

/** Message FR pour invitation parent (copie presse-papiers) — aligné app. */
export function buildGuardianInviteMessage(params: {
  clubName: string;
  code: string;
  childName?: string;
}): string {
  const name = params.childName?.trim() || "ton enfant";
  return `Tu pourras voir le planning de ${name}, répondre aux convocations et payer la cotisation.
Club : ${params.clubName}
Code : ${params.code}
Ouvre l'app → « J'ai un code d'invitation » et saisis ce code.
Tu peux aussi te connecter sur le portail avec cet e-mail.`;
}

/**
 * Joueurs sans parent lié/invité — candidats pour « Inviter un parent ».
 * Pas de filtre équipe (aligné Cloud Functions / fiche membre).
 */
export function membersWithoutParent(
  members: ClubMemberRecord[],
  parentRows: ClubParentRow[],
): ClubMemberRecord[] {
  const occupied = new Set<string>();
  for (const row of parentRows) {
    for (const child of row.children) {
      occupied.add(child.memberId);
    }
  }
  return members.filter(
    (member) =>
      !occupied.has(member.memberId) && member.role === MemberRoles.player,
  );
}
