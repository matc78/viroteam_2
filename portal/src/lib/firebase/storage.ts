import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";
import { getFirebaseApp } from "./app";

/** Instance Storage du portail (bucket du projet Firebase). */
export function getAppStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}

/**
 * Upload une image JPEG/PNG et retourne l’URL de téléchargement.
 */
export async function uploadImageAtPath(params: {
  path: string;
  bytes: ArrayBuffer;
  contentType: string;
}): Promise<string> {
  const storageRef = ref(getAppStorage(), params.path);
  await uploadBytes(storageRef, params.bytes, {
    contentType: params.contentType,
  });
  return getDownloadURL(storageRef);
}

/** Chemin Storage du logo club (aligné app mobile). */
export function clubLogoStoragePath(clubId: string): string {
  return `clubs/${clubId}/logo.jpg`;
}

/** Chemin Storage de l’avatar utilisateur. */
export function userAvatarStoragePath(uid: string): string {
  return `users/${uid}/avatar.jpg`;
}
