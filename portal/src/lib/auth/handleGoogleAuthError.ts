import { EmailUsedWithPasswordError } from "@/lib/firebase/googleAuth";

type GoogleAuthErrorResult = {
  formMessage: string;
  emailToPrefill?: string;
  shouldStopLoading: boolean;
};

/** Normalise les erreurs Google Auth pour les formulaires login/signup. */
export function handleGoogleAuthError(
  error: unknown,
  fallbackMessage = "Connexion Google impossible.",
): GoogleAuthErrorResult {
  if (error instanceof EmailUsedWithPasswordError) {
    return {
      formMessage: error.message,
      emailToPrefill: error.email,
      shouldStopLoading: true,
    };
  }

  return {
    formMessage:
      error instanceof Error
        ? error.message
        : fallbackMessage,
    shouldStopLoading: true,
  };
}
