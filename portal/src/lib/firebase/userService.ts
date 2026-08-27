import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import { Collections, Fields } from "./constants";
import { parseUserProfile, splitDisplayName, ViroUserProfile } from "./types";

/** Charge le profil users/{uid}. */
export async function getUserProfile(uid: string): Promise<ViroUserProfile | null> {
  const snap = await getDoc(doc(getAppFirestore(), Collections.users, uid));
  if (!snap.exists()) return null;
  return parseUserProfile(uid, snap.data() as Record<string, unknown>);
}

/**
 * Crée le document users/{uid} à l’inscription (aligné ViroUser.toCreateMap).
 */
export async function createUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<void> {
  const emailNorm = params.email.trim().toLowerCase();
  const { firstName, lastName } = splitDisplayName(params.displayName);
  const displayName =
    params.displayName.trim() ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    emailNorm;

  await setDoc(doc(getAppFirestore(), Collections.users, params.uid), {
    [Fields.uid]: params.uid,
    [Fields.email]: params.email.trim(),
    [Fields.emailNorm]: emailNorm,
    [Fields.firstName]: firstName,
    [Fields.lastName]: lastName,
    [Fields.displayName]: displayName,
    [Fields.clubMemberships]: [],
    [Fields.parentLinks]: [],
    [Fields.parentClubIds]: [],
    [Fields.flags]: {
      [Fields.profileCompleted]: Boolean(firstName),
      [Fields.disabled]: false,
    },
    [Fields.createdAt]: serverTimestamp(),
    [Fields.updatedAt]: serverTimestamp(),
  });
}

/** Met à jour l’avatar utilisateur (et snapshot membre du club actif si fourni). */
export async function updateUserAvatarUrl(params: {
  uid: string;
  avatarUrl: string;
  /** Club dont la fiche membre `members/{uid}` doit être sync. */
  syncMemberClubId?: string | null;
}): Promise<void> {
  await updateDoc(doc(getAppFirestore(), Collections.users, params.uid), {
    [Fields.avatarUrl]: params.avatarUrl,
    [Fields.updatedAt]: serverTimestamp(),
  });

  const clubId = params.syncMemberClubId?.trim();
  if (!clubId) return;
  try {
    const memberRef = doc(
      getAppFirestore(),
      Collections.clubs,
      clubId,
      Collections.members,
      params.uid,
    );
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) return;
    const data = memberSnap.data() as Record<string, unknown>;
    const snapshot =
      data[Fields.snapshot] && typeof data[Fields.snapshot] === "object"
        ? { ...(data[Fields.snapshot] as Record<string, unknown>) }
        : {};
    snapshot[Fields.avatarUrl] = params.avatarUrl;
    await updateDoc(memberRef, {
      [Fields.snapshot]: snapshot,
      [Fields.updatedAt]: serverTimestamp(),
    });
  } catch {
    // Sync membre best-effort — ne bloque pas l’avatar user.
  }
}

/** Met à jour le profil utilisateur avant de rejoindre un club sur l’app. */
export async function updateUserProfileForJoin(params: {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
}): Promise<void> {
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();
  const displayName = [firstName, lastName].filter(Boolean).join(" ");
  const emailNorm = params.email.trim().toLowerCase();

  await setDoc(
    doc(getAppFirestore(), Collections.users, params.uid),
    {
      [Fields.uid]: params.uid,
      [Fields.email]: params.email.trim(),
      [Fields.emailNorm]: emailNorm,
      [Fields.firstName]: firstName,
      [Fields.lastName]: lastName,
      [Fields.displayName]: displayName,
      [Fields.flags]: {
        [Fields.profileCompleted]: false,
        [Fields.disabled]: false,
      },
      [Fields.updatedAt]: serverTimestamp(),
    },
    { merge: true },
  );
}
