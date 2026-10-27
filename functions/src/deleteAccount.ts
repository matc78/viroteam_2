import * as admin from "firebase-admin";
import type {
  DocumentReference,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { db, defineDualCallable } from "./db";
import { authEmailOf, normalizeEmail, requireUid, stringArray, uniq } from "./common";
import {
  accountUidOf,
  decrementCount,
  isLastAdmin,
  type AdminMemberRef,
} from "./memberAdminUtils";
import { activeGuardianUids, recomputeParentTeamIdsSafe } from "./parentTeams";

const MEMBER_STATUS_ARCHIVED = "archived";
const INVITATION_STATUS_PENDING = "pending";
const INVITATION_STATUS_REVOKED = "revoked";
const TEAM_ROSTER_FIELDS = ["playerIds", "coachIds", "pendingPlayerIds"] as const;

type DeleteMyAccountResponse = { ok: true; anonymizedMembers: number };

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

/**
 * Étapes en échec pendant une suppression. Tant qu'il en reste, le compte
 * Auth n'est pas supprimé : l'utilisateur peut relancer (étapes idempotentes)
 * au lieu de laisser des données personnelles orphelines.
 */
type FailedSteps = string[];

function logStep(
  failures: FailedSteps,
  step: string,
  details: Record<string, unknown>,
): void {
  failures.push(step);
  console.error(`deleteMyAccount: ${step} échoué`, details);
}

/** Fiches liées au compte (`accountUid` puis `userId` en compat v1), dédoublonnées. */
async function findMemberDocs(uid: string): Promise<QueryDocumentSnapshot[]> {
  const [byAccount, byUserId] = await Promise.all([
    db().collectionGroup("members").where("accountUid", "==", uid).get(),
    db().collectionGroup("members").where("userId", "==", uid).get(),
  ]);
  const byPath = new Map<string, QueryDocumentSnapshot>();
  for (const doc of [...byAccount.docs, ...byUserId.docs]) {
    // Ignore les docs qui ne sont pas des fiches club (ex. autre sous-collection "members").
    if (doc.ref.parent.parent?.parent.id !== "clubs") continue;
    byPath.set(doc.ref.path, doc);
  }
  return [...byPath.values()];
}

/** Anonymise une fiche : identité générique, compte délié, statut archivé. */
async function anonymizeMember(memberDoc: QueryDocumentSnapshot): Promise<void> {
  await memberDoc.ref.update({
    firstName: "Membre",
    lastName: "supprimé",
    snapshot: { displayName: "Membre supprimé" },
    accountUid: admin.firestore.FieldValue.delete(),
    userId: admin.firestore.FieldValue.delete(),
    status: MEMBER_STATUS_ARCHIVED,
    anonymizedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Retire l'uid des admins du club et décrémente `memberCount` (min 0). */
async function detachFromClub(clubRef: DocumentReference, uid: string): Promise<void> {
  await db().runTransaction(async (tx) => {
    const clubSnap = await tx.get(clubRef);
    if (!clubSnap.exists) return;
    const club = clubSnap.data() ?? {};
    const adminIds = stringArray(club.adminIds);
    const patch: Record<string, unknown> = {
      memberCount: decrementCount(club.memberCount),
      updatedAt: serverTimestamp(),
    };
    if (adminIds.includes(uid)) {
      patch.adminIds = adminIds.filter((id) => id !== uid);
    }
    tx.update(clubRef, patch);
  });
}

/** Retire `memberId` et `uid` de tous les rosters d'équipe du club. */
async function removeFromTeams(
  clubRef: DocumentReference,
  rosterIds: string[],
): Promise<void> {
  const teamsCol = clubRef.collection("teams");
  const snaps = await Promise.all(
    TEAM_ROSTER_FIELDS.flatMap((field) =>
      rosterIds.map((id) => teamsCol.where(field, "array-contains", id).get()),
    ),
  );
  const patches = new Map<DocumentReference, Record<string, unknown>>();
  for (const snap of snaps) {
    for (const teamDoc of snap.docs) {
      const data = teamDoc.data();
      const patch = patches.get(teamDoc.ref) ?? {};
      for (const field of TEAM_ROSTER_FIELDS) {
        const ids = stringArray(data[field]);
        const next = ids.filter((id) => !rosterIds.includes(id));
        if (next.length !== ids.length) patch[field] = next;
      }
      if (Object.keys(patch).length > 0) patches.set(teamDoc.ref, patch);
    }
  }
  if (patches.size === 0) return;
  const batch = db().batch();
  for (const [ref, patch] of patches) {
    batch.update(ref, { ...patch, updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

/**
 * Refuse la suppression si le compte est le dernier admin d'un club (même
 * garde que `removeMember`) : le club resterait sans personne pour le gérer.
 * Les fiches déjà anonymisées (archivées) ne comptent pas comme admin.
 */
async function assertNotLastAdmin(
  uid: string,
  memberDocs: QueryDocumentSnapshot[],
): Promise<void> {
  const targetByClub = new Map<string, AdminMemberRef>();
  const clubIds = new Set<string>();
  for (const memberDoc of memberDocs) {
    const clubId = memberDoc.ref.parent.parent!.id;
    targetByClub.set(clubId, { memberId: memberDoc.id, accountUid: uid });
    if (memberDoc.data().role === "admin") clubIds.add(clubId);
  }
  const adminClubs = await db()
    .collection("clubs")
    .where("adminIds", "array-contains", uid)
    .get();
  for (const clubDoc of adminClubs.docs) clubIds.add(clubDoc.id);

  for (const clubId of clubIds) {
    const clubRef = db().collection("clubs").doc(clubId);
    const [clubSnap, adminsSnap] = await Promise.all([
      clubRef.get(),
      clubRef.collection("members").where("role", "==", "admin").get(),
    ]);
    const adminMembers = adminsSnap.docs
      .filter((doc) => doc.data().status !== MEMBER_STATUS_ARCHIVED)
      .map((doc) => ({ memberId: doc.id, accountUid: accountUidOf(doc.data()) }));
    const target = targetByClub.get(clubId) ?? { memberId: uid, accountUid: uid };
    if (
      isLastAdmin({
        adminIds: stringArray(clubSnap.data()?.adminIds),
        adminMembers,
        target,
      })
    ) {
      const clubName = String(clubSnap.data()?.name ?? "").trim() || clubId;
      throw new HttpsError(
        "failed-precondition",
        `Tu es le dernier administrateur de « ${clubName} » : nomme un autre admin avant de supprimer ton compte.`,
      );
    }
  }
}

/**
 * Étape 1 : fiches membres → nettoyage club/équipes/index, puis anonymisation
 * (en dernier : une fiche anonymisée n'est plus retrouvée, donc un nouvel
 * appel rejoue le nettoyage d'une fiche restée en échec).
 * Retourne le nombre de fiches anonymisées.
 */
async function anonymizeMemberships(
  uid: string,
  memberDocs: QueryDocumentSnapshot[],
  failures: FailedSteps,
): Promise<number> {
  let anonymized = 0;
  for (const memberDoc of memberDocs) {
    const memberId = memberDoc.id;
    const clubRef = memberDoc.ref.parent.parent!;
    const clubId = clubRef.id;
    const context = { uid, clubId, memberId };

    // Guardians actifs à recalculer une fois la fiche archivée.
    let guardianUids: string[] = [];
    try {
      guardianUids = await activeGuardianUids(db(), clubId, memberId);
    } catch (error) {
      logStep(failures, "lecture guardians de la fiche", { ...context, error });
    }

    const failuresBefore = failures.length;
    try {
      await detachFromClub(clubRef, uid);
    } catch (error) {
      logStep(failures, "mise à jour club (adminIds/memberCount)", { ...context, error });
    }

    try {
      await clubRef.collection("member_accounts").doc(uid).delete();
    } catch (error) {
      logStep(failures, "suppression member_accounts", { ...context, error });
    }

    try {
      await removeFromTeams(clubRef, uniq([memberId, uid]));
    } catch (error) {
      logStep(failures, "retrait des équipes", { ...context, error });
    }

    if (failures.length === failuresBefore) {
      try {
        await anonymizeMember(memberDoc);
        anonymized += 1;
      } catch (error) {
        logStep(failures, "anonymisation fiche", { ...context, error });
      }
    }

    for (const parentUid of guardianUids) {
      await recomputeParentTeamIdsSafe(db(), parentUid);
    }
  }
  return anonymized;
}

/** Étape 2 : invitations pending adressées à l'e-mail → revoked. */
async function revokePendingInvitations(emailNorm: string): Promise<void> {
  if (!emailNorm) return;
  const snap = await db()
    .collectionGroup("invitations")
    .where("email", "==", emailNorm)
    .where("status", "==", INVITATION_STATUS_PENDING)
    .get();
  if (snap.empty) return;
  const batch = db().batch();
  for (const inviteDoc of snap.docs) {
    batch.update(inviteDoc.ref, {
      status: INVITATION_STATUS_REVOKED,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/** Étape 3 : liens guardian dont le compte est le parent → supprimés. */
async function deleteGuardianLinks(uid: string): Promise<void> {
  const snap = await db()
    .collectionGroup("guardians")
    .where("parentUid", "==", uid)
    .get();
  if (snap.empty) return;
  const batch = db().batch();
  for (const guardianDoc of snap.docs) {
    batch.delete(guardianDoc.ref);
  }
  await batch.commit();
  // `parentLinks` vit sur users/{uid} (côté parent) : écrasé à l'étape 4.
}

/** E-mail du compte : token Auth, sinon fiche Auth. */
async function resolveAccountEmail(
  request: CallableRequest,
  uid: string,
  failures: FailedSteps,
): Promise<string> {
  const fromToken = authEmailOf(request);
  if (fromToken) return fromToken;
  try {
    const user = await admin.auth().getUser(uid);
    return normalizeEmail(user.email);
  } catch (error) {
    logStep(failures, "lecture e-mail Auth", { uid, error });
    return "";
  }
}

/** Étape 4a : sous-collections du profil (`fcmTokens`, `chatState`…). */
async function deleteUserSubcollections(uid: string): Promise<void> {
  const userRef = db().collection("users").doc(uid);
  for (const subcollection of await userRef.listCollections()) {
    await db().recursiveDelete(subcollection);
  }
}

/**
 * Suppression de compte : anonymisation en cascade puis suppression Firebase
 * Auth. Refusée si le compte est le dernier admin d'un club. Chaque étape est
 * loggée ; si l'une échoue, le compte Auth est conservé et l'appel renvoie une
 * erreur (relance idempotente).
 * Le client réauthentifie, appelle cette callable, puis `signOut`.
 * Prod → v2-prod ; `deleteMyAccountDev` → v2-dev.
 */
async function handleDeleteMyAccount(
  request: CallableRequest,
): Promise<DeleteMyAccountResponse> {
  const uid = requireUid(request);
  const failures: FailedSteps = [];
  const emailNorm = await resolveAccountEmail(request, uid, failures);

  // 0. Fiches du compte (sans elles, impossible d'anonymiser : on s'arrête).
  let memberDocs: QueryDocumentSnapshot[];
  try {
    memberDocs = await findMemberDocs(uid);
  } catch (error) {
    console.error("deleteMyAccount: recherche des fiches échouée", { uid, error });
    throw new HttpsError(
      "unavailable",
      "Suppression impossible pour le moment — réessaie dans un instant",
    );
  }
  await assertNotLastAdmin(uid, memberDocs);

  // 1. Fiches membres.
  const anonymizedMembers = await anonymizeMemberships(uid, memberDocs, failures);

  // 2. Invitations pending.
  try {
    await revokePendingInvitations(emailNorm);
  } catch (error) {
    logStep(failures, "révocation invitations", { uid, error });
  }

  // 3. Liens guardian.
  try {
    await deleteGuardianLinks(uid);
  } catch (error) {
    logStep(failures, "suppression guardians", { uid, error });
  }

  // 4. Profil user : sous-collections, puis marqueur de suppression (set sans merge).
  try {
    await deleteUserSubcollections(uid);
  } catch (error) {
    logStep(failures, "suppression sous-collections users/{uid}", { uid, error });
  }
  try {
    await db().collection("users").doc(uid).set({
      deleted: true,
      deletedAt: serverTimestamp(),
      flags: { disabled: true },
    });
  } catch (error) {
    logStep(failures, "écrasement users/{uid}", { uid, error });
  }

  if (failures.length > 0) {
    throw new HttpsError(
      "internal",
      "Suppression incomplète — réessaie dans un instant",
      { failedSteps: uniq(failures) },
    );
  }

  // 5. Compte Auth. Échec ⇒ erreur explicite (les données sont déjà
  // anonymisées ; un nouvel appel est idempotent).
  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "auth/user-not-found") {
      console.error("deleteMyAccount: suppression Auth échouée", { uid, error });
      throw new HttpsError(
        "internal",
        "Données anonymisées mais suppression du compte échouée — réessaie",
      );
    }
  }

  return { ok: true, anonymizedMembers };
}

export const {
  prod: deleteMyAccount,
  dev: deleteMyAccountDev,
} = defineDualCallable(handleDeleteMyAccount);
