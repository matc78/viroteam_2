import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { requireString, requireUid, stringArray, uniq } from "../common";
import { db, defineDualCallable } from "../db";
import { resolveAuthUid, resolveAuthUids, upsertSystemConversation } from "./sync";

/**
 * Crée (ou réutilise) une DM / coach_group entre l’appelant et des coaches/admins.
 *
 * Args : `{ clubId, targetUids: string[], teamId?: string }`
 */
async function handleCreateCoachDm(request: CallableRequest): Promise<{
  conversationId: string;
}> {
  const uid = requireUid(request);
  const clubId = requireString(request.data?.clubId, "clubId");
  const teamIdRaw = request.data?.teamId;
  const teamId =
    typeof teamIdRaw === "string" && teamIdRaw.trim()
      ? teamIdRaw.trim()
      : undefined;

  const targetUids = uniq(
    stringArray(request.data?.targetUids).filter((id) => id !== uid),
  );
  if (targetUids.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Choisis au moins un coach ou un admin",
    );
  }

  const firestore = db();
  const clubRef = firestore.collection("clubs").doc(clubId);
  const clubSnap = await clubRef.get();
  if (!clubSnap.exists) {
    throw new HttpsError("not-found", "Club introuvable");
  }
  const adminIds = new Set(stringArray(clubSnap.data()?.adminIds));

  // Comme ensureClubChatSynced : index member_accounts OU fiche members/{uid}.
  const callerAccount = await clubRef.collection("member_accounts").doc(uid).get();
  const directMember = await clubRef.collection("members").doc(uid).get();
  const callerMemberId = callerAccount.exists
    ? String(callerAccount.data()?.memberId ?? "").trim()
    : directMember.exists
      ? uid
      : "";
  const userSnap = await firestore.collection("users").doc(uid).get();
  const userData = userSnap.data() ?? {};
  const parentClubIds = stringArray(userData.parentClubIds);
  const parentTeamIds = new Set(stringArray(userData.parentTeamIds));
  const parentLinksRaw = Array.isArray(userData.parentLinks)
    ? (userData.parentLinks as unknown[])
    : [];
  const activeParentLinksInClub = parentLinksRaw
    .filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object")
    .map((item) => ({
      clubId: String(item.clubId ?? ""),
      memberId: String(item.memberId ?? ""),
      status: String(item.status ?? ""),
    }))
    .filter(
      (link) =>
        link.clubId === clubId &&
        link.memberId.length > 0 &&
        link.status === "active",
    );
  const isMember = callerAccount.exists || directMember.exists;
  // parentClubIds peut être stale : les liens actifs font foi (comme l’app).
  const isParent =
    parentClubIds.includes(clubId) || activeParentLinksInClub.length > 0;
  if (!isMember && !isParent) {
    throw new HttpsError("permission-denied", "Tu n’es pas dans ce club");
  }

  const teamsSnap = await clubRef.collection("teams").get();
  const callerTeamIds = new Set<string>();
  for (const teamDoc of teamsSnap.docs) {
    const data = teamDoc.data();
    const players = stringArray(data.playerIds);
    const coaches = stringArray(data.coachIds);
    const rosterHit =
      Boolean(callerMemberId) &&
      (players.includes(callerMemberId) ||
        players.includes(uid) ||
        coaches.includes(callerMemberId) ||
        coaches.includes(uid));
    if (rosterHit || parentTeamIds.has(teamDoc.id)) {
      callerTeamIds.add(teamDoc.id);
    }
  }
  // parentTeamIds parfois vide : équipes des enfants via parentLinks.
  if (isParent && callerTeamIds.size === 0) {
    for (const link of activeParentLinksInClub) {
      const childSnap = await clubRef.collection("members").doc(link.memberId).get();
      if (!childSnap.exists) continue;
      for (const tid of stringArray(childSnap.data()?.teamIds)) {
        if (tid) callerTeamIds.add(tid);
      }
    }
  }

  if (teamId && !callerTeamIds.has(teamId)) {
    throw new HttpsError(
      "permission-denied",
      "Cette équipe ne te concerne pas",
    );
  }

  const allowedCoachUids = new Set<string>();
  for (const teamDoc of teamsSnap.docs) {
    if (!callerTeamIds.has(teamDoc.id)) continue;
    if (teamId && teamDoc.id !== teamId) continue;
    const coachUids = await resolveAuthUids(
      firestore,
      clubId,
      stringArray(teamDoc.data().coachIds),
    );
    for (const coachUid of coachUids) allowedCoachUids.add(coachUid);
  }
  // adminIds peut être memberId ou Auth uid — toujours résoudre.
  for (const adminUid of await resolveAuthUids(
    firestore,
    clubId,
    [...adminIds],
  )) {
    allowedCoachUids.add(adminUid);
  }
  // Filet : admins déclarés par rôle fiche (adminIds parfois incomplet).
  const adminMembersSnap = await clubRef
    .collection("members")
    .where("role", "==", "admin")
    .get();
  for (const adminDoc of adminMembersSnap.docs) {
    const adminUid = await resolveAuthUid(firestore, clubId, adminDoc.id);
    if (adminUid) allowedCoachUids.add(adminUid);
  }

  for (const target of targetUids) {
    if (!allowedCoachUids.has(target)) {
      throw new HttpsError(
        "permission-denied",
        "Tu ne peux discuter qu’avec tes coaches ou un admin",
      );
    }
  }

  const participantUids = uniq([uid, ...targetUids]);
  const dmKey = `dm:${[...participantUids].sort().join("_")}`;

  const title =
    targetUids.length === 1
      ? await displayNameOf(firestore, targetUids[0]!)
      : "Coachs";

  // upsertSystemConversation est idempotent (id stable + create).
  const conversationId = await upsertSystemConversation({
    firestore,
    clubId,
    systemKey: dmKey,
    type: targetUids.length > 1 ? "coach_group" : "dm",
    title,
    teamId,
    participantUids,
    writePolicy: "open",
  });

  return { conversationId };
}

async function displayNameOf(
  firestore: FirebaseFirestore.Firestore,
  targetUid: string,
): Promise<string> {
  const snap = await firestore.collection("users").doc(targetUid).get();
  const data = snap.data() ?? {};
  const display = String(data.displayName ?? "").trim();
  if (display) return display;
  const first = String(data.firstName ?? "").trim();
  const last = String(data.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();
  return full || "Coach";
}

export const { prod: createCoachDm, dev: createCoachDmDev } = defineDualCallable(
  handleCreateCoachDm,
);
