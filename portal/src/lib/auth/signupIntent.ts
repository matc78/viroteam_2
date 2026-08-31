/** Intent d’inscription fondateur (aligné SignUpIntent Flutter). */
export const SIGNUP_INTENT_KEY = "signup_intent";
export const SIGNUP_INTENT_FOUNDER = "founder";

export function setFounderSignupIntent(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SIGNUP_INTENT_KEY, SIGNUP_INTENT_FOUNDER);
}

export function readSignupIntent(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(SIGNUP_INTENT_KEY);
}

export function isFounderSignupIntent(): boolean {
  return readSignupIntent() === SIGNUP_INTENT_FOUNDER;
}

export function clearSignupIntent(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SIGNUP_INTENT_KEY);
}

export function captureFounderIntentFromSearch(search: string): void {
  const params = new URLSearchParams(search);
  if (params.get("intent") === SIGNUP_INTENT_FOUNDER) {
    setFounderSignupIntent();
  }
}
