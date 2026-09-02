import * as admin from "firebase-admin";
import type {
  DocumentReference,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { db, defineDualCallable } from "./db";
import { authEmailOf, normalizeEmail, requireUid, stringArray, uniq } from "./common";
import { decrementCount } from "./memberAdminUtils";
import { activeGuardianUids, recomputeParentTeamIdsSafe } from "./parentTeams";

const MEMBER_STATUS_ARCHIVED = "archived";
const INVITATION_STATUS_PENDING = "pending";
const INVITATION_STATUS_REVOKED = "revoked";
const TEAM_ROSTER_FIELDS = ["playerIds", "coachIds", "pendingPlayerIds"] as const;

type DeleteMyAccountResponse = { ok: true; anonymizedMembers: number };

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function logStep(step: string, details: Record<string, unknown>): void {
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
 * Étape 1 : fiches membres → anonymisation + nettoyage club/équipes/index.
 * Retourne le nombre de fiches anonymisées.
 */
async function anonymizeMemberships(uid: string): Promise<number> {
  let memberDocs: QueryDocumentSnapshot[] = [];
  try {
    memberDocs = await findMemberDocs(uid);
  } catch (error) {
    logStep("recherche des fiches", { uid, error });
    return 0;
  }

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
      logStep("lecture guardians de la fiche", { ...context, error });
    }

    try {
      await anonymizeMember(memberDoc);
      anonymized += 1;
    } catch (error) {
      logStep("anonymisation fiche", { ...context, error });
    }

    try {
      await detachFromClub(clubRef, uid);
    } catch (error) {
      logStep("mise à jour club (adminIds/memberCount)", { ...context, error });
    }

    try {
      await clubRef.collection("member_accounts").doc(uid).delete();
    } catch (error) {
      logStep("suppression member_accounts", { ...context, error });
    }

    try {
      await removeFromTeams(clubRef, uniq([memberId, uid]));
    } catch (error) {
      logStep("retrait des équipes", { ...context, error });
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
async function resolveAccountEmail(request: CallableRequest, uid: string): Promise<string> {
  const fromToken = authEmailOf(request);
  if (fromToken) return fromToken;
  try {
    const user = await admin.auth().getUser(uid);
    return normalizeEmail(user.email);
  } catch (error) {
    logStep("lecture e-mail Auth", { uid, error });
    return "";
  }
}

/**
 * Suppression de compte : anonymisation en cascade (tolérante aux erreurs
 * partielles, chaque étape loggée) puis suppression Firebase Auth.
 * Le client réauthentifie, appelle cette callable, puis `signOut`.
 * Prod → v2-prod ; `deleteMyAccountDev` → v2-dev.
 */
async function handleDeleteMyAccount(
  request: CallableRequest,
): Promise<DeleteMyAccountResponse> {
  const uid = requireUid(request);
  const emailNorm = await resolveAccountEmail(request, uid);

  // 1. Fiches membres.
  const anonymizedMembers = await anonymizeMemberships(uid);

  // 2. Invitations pending.
  try {
    await revokePendingInvitations(emailNorm);
  } catch (error) {
    logStep("révocation invitations", { uid, error });
  }

  // 3. Liens guardian.
  try {
    await deleteGuardianLinks(uid);
  } catch (error) {
    logStep("suppression guardians", { uid, error });
  }

  // 4. Profil user → marqueur de suppression (set sans merge).
  try {
    await db().collection("users").doc(uid).set({
      deleted: true,
      deletedAt: serverTimestamp(),
      flags: { disabled: true },
    });
  } catch (error) {
    logStep("écrasement users/{uid}", { uid, error });
  }

  // 5. Compte Auth. Échec ⇒ erreur explicite (les données sont déjà
  // anonymisées ; un nouvel appel est idempotent).
  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "auth/user-not-found") {
      logStep("suppression Auth", { uid, error });
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
