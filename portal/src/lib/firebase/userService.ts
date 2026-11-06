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
import type { NotificationPreferences } from "./notificationPreferences";
import {
  formatFirstName,
  formatLastName,
  softFormatFirstName,
  softFormatLastName,
} from "@/lib/format/personDataFormat";
import { LegalTerms } from "@/lib/legal/terms";

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
  const split = splitDisplayName(params.displayName);
  const firstName = softFormatFirstName(split.firstName);
  const lastName = softFormatLastName(split.lastName);
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    params.displayName.trim() ||
    emailNorm;

  await setDoc(doc(getAppFirestore(), Collections.users, params.uid), {
    [Fields.uid]: params.uid,
    [Fields.email]: emailNorm,
    [Fields.emailNorm]: emailNorm,
    [Fields.firstName]: firstName,
    [Fields.lastName]: lastName,
    [Fields.displayName]: displayName,
    [Fields.clubMemberships]: [],
    [Fields.parentLinks]: [],
    [Fields.parentClubIds]: [],
    [Fields.parentTeamIds]: [],
    [Fields.flags]: {
      [Fields.profileCompleted]: Boolean(firstName),
      [Fields.disabled]: false,
    },
    [Fields.legal]: {
      [Fields.termsAcceptedAt]: serverTimestamp(),
      [Fields.termsVersion]: LegalTerms.currentVersion,
    },
    [Fields.createdAt]: serverTimestamp(),
    [Fields.updatedAt]: serverTimestamp(),
  });
}

/**
 * Met à jour l’avatar utilisateur (`users/{uid}` uniquement). Les fiches
 * membres `members/{uid}` sont synchronisées par un trigger serveur.
 */
export async function updateUserAvatarUrl(params: {
  uid: string;
  avatarUrl: string;
}): Promise<void> {
  await updateDoc(doc(getAppFirestore(), Collections.users, params.uid), {
    [Fields.avatarUrl]: params.avatarUrl,
    [Fields.updatedAt]: serverTimestamp(),
  });
}

/** Met à jour le profil utilisateur avant d’accepter une invitation club. */
export async function updateUserProfileForJoin(params: {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
}): Promise<void> {
  const firstName = formatFirstName(params.firstName);
  const lastName = formatLastName(params.lastName);
  const displayName = [firstName, lastName].filter(Boolean).join(" ");
  const emailNorm = params.email.trim().toLowerCase();

  await setDoc(
    doc(getAppFirestore(), Collections.users, params.uid),
    {
      [Fields.uid]: params.uid,
      [Fields.email]: emailNorm,
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

/** Persiste les préférences de notifications push. */
export async function updateNotificationPreferences(params: {
  uid: string;
  preferences: NotificationPreferences;
}): Promise<void> {
  await updateDoc(doc(getAppFirestore(), Collections.users, params.uid), {
    [Fields.notificationPreferences]: params.preferences,
    [Fields.updatedAt]: serverTimestamp(),
  });
}
