import {
  EmailAuthProvider,
  GoogleAuthProvider,
  User,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updateEmail,
  updatePassword,
} from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { authErrorMessage } from "./authErrors";
import { validatePassword } from "@/lib/auth/passwordPolicy";
import { getAppFirestore } from "./app";
import { Collections, Fields } from "./constants";

const googleProvider = new GoogleAuthProvider();

/** Indique si le compte a le provider email/mot de passe. */
export function hasPasswordProvider(user: User): boolean {
  return user.providerData.some((provider) => provider.providerId === "password");
}

/** Indique si le compte a le provider Google. */
export function hasGoogleProvider(user: User): boolean {
  return user.providerData.some(
    (provider) => provider.providerId === "google.com",
  );
}

/** Libellés FR des providers Auth liés au compte. */
export function authProviderLabels(user: User): string[] {
  const labels: string[] = [];
  if (hasPasswordProvider(user)) labels.push("Email / mot de passe");
  if (hasGoogleProvider(user)) labels.push("Google");
  if (labels.length === 0) labels.push("Inconnu");
  return labels;
}

/**
 * Réauthentifie l’utilisateur (mot de passe et/ou Google selon les providers).
 */
export async function reauthenticateUser(params: {
  user: User;
  password?: string;
}): Promise<void> {
  const { user, password } = params;
  try {
    if (hasPasswordProvider(user)) {
      const email = user.email?.trim();
      if (!email) throw new Error("E-mail manquant pour la réauthentification.");
      if (!password?.trim()) {
        throw new Error("Mot de passe actuel requis.");
      }
      const credential = EmailAuthProvider.credential(email, password);
      await reauthenticateWithCredential(user, credential);
      return;
    }
    if (hasGoogleProvider(user)) {
      await reauthenticateWithPopup(user, googleProvider);
      return;
    }
    throw new Error("Aucun moyen de réauthentification disponible.");
  } catch (error) {
    throw new Error(authErrorMessage(error));
  }
}

/** Met à jour l’e-mail Auth + Firestore après réauth. */
export async function changeUserEmail(params: {
  user: User;
  newEmail: string;
  currentPassword?: string;
}): Promise<void> {
  const nextEmail = params.newEmail.trim();
  if (!nextEmail) throw new Error("Nouvel e-mail requis.");
  await reauthenticateUser({
    user: params.user,
    password: params.currentPassword,
  });
  try {
    await updateEmail(params.user, nextEmail);
  } catch (error) {
    throw new Error(authErrorMessage(error));
  }
  await updateDoc(doc(getAppFirestore(), Collections.users, params.user.uid), {
    [Fields.email]: nextEmail,
    [Fields.emailNorm]: nextEmail.toLowerCase(),
    [Fields.updatedAt]: serverTimestamp(),
  });
}

/** Change le mot de passe (provider password uniquement). */
export async function changeUserPassword(params: {
  user: User;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  if (!hasPasswordProvider(params.user)) {
    throw new Error("Ce compte n’utilise pas de mot de passe.");
  }
  const policyError = validatePassword(params.newPassword);
  if (policyError) {
    throw new Error(policyError);
  }
  await reauthenticateUser({
    user: params.user,
    password: params.currentPassword,
  });
  try {
    await updatePassword(params.user, params.newPassword);
  } catch (error) {
    throw new Error(authErrorMessage(error));
  }
}

/**
 * Désactive le profil Firestore puis supprime le compte Auth.
 * Nécessite une réauthentification récente.
 */
export async function deleteUserAccount(params: {
  user: User;
  currentPassword?: string;
}): Promise<void> {
  await reauthenticateUser({
    user: params.user,
    password: params.currentPassword,
  });
  await updateDoc(doc(getAppFirestore(), Collections.users, params.user.uid), {
    [`${Fields.flags}.${Fields.disabled}`]: true,
    [Fields.updatedAt]: serverTimestamp(),
  });
  try {
    await deleteUser(params.user);
  } catch (error) {
    throw new Error(authErrorMessage(error));
  }
}
