import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  UserCredential,
  signInWithPopup,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/app";
import { authErrorMessage } from "@/lib/firebase/authErrors";
import {
  createUserProfile,
  getUserProfile,
} from "@/lib/firebase/userService";

const googleProvider = new GoogleAuthProvider();

export const GOOGLE_SIGN_IN_CANCELLED = "CANCELLED";

/** Levée quand un compte e-mail/mot de passe existe déjà pour cet e-mail Google. */
export class EmailUsedWithPasswordError extends Error {
  readonly email?: string;

  constructor(email?: string) {
    super(
      "Un compte existe déjà avec cet e-mail. Connecte-toi avec ton mot de passe.",
    );
    this.name = "EmailUsedWithPasswordError";
    this.email = email;
  }
}

function mapGoogleAuthError(error: unknown): never {
  if (error instanceof FirebaseError) {
    if (error.code === "auth/account-exists-with-different-credential") {
      const email =
        typeof error.customData?.email === "string"
          ? error.customData.email
          : undefined;
      throw new EmailUsedWithPasswordError(email);
    }
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error(GOOGLE_SIGN_IN_CANCELLED);
    }
  }
  throw new Error(authErrorMessage(error));
}

/**
 * Connexion Google. Crée le profil Firestore si absent (inscription).
 */
export async function signInWithGoogle(options?: {
  createProfileIfMissing?: boolean;
}): Promise<UserCredential> {
  const auth = getFirebaseAuth();

  let credential: UserCredential;
  try {
    credential = await signInWithPopup(auth, googleProvider);
  } catch (error) {
    mapGoogleAuthError(error);
  }

  if (options?.createProfileIfMissing) {
    const existingProfile = await getUserProfile(credential.user.uid);
    if (!existingProfile) {
      await createUserProfile({
        uid: credential.user.uid,
        email: credential.user.email ?? "",
        displayName: credential.user.displayName ?? "",
      });
    }
  }

  return credential;
}
