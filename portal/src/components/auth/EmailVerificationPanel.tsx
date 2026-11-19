"use client";

import { FirebaseError } from "firebase/app";
import { reload, sendEmailVerification } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/app";
import deniedStyles from "./AccessDenied.module.css";
import formStyles from "./AuthForm.module.css";
import styles from "./JoinOnboardingForm.module.css";

/** Intervalle de vérification silencieuse tant que le panneau est affiché. */
const VERIFICATION_POLL_MS = 4000;

type EmailVerificationPanelProps = {
  /** Appelé une fois l’adresse confirmée (jeton rafraîchi) : relance l’acceptation. */
  onVerified: () => void;
};

/**
 * Demande de confirmer l’adresse e-mail avant d’accepter une invitation
 * (refus `email_not_verified` des Functions). Envoie le lien dès l’affichage
 * et détecte seul la confirmation (retour sur l’onglet + vérification
 * périodique). Miroir de `showEmailVerificationDialog` côté app.
 */
export function EmailVerificationPanel({ onVerified }: EmailVerificationPanelProps) {
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoSent = useRef(false);
  const checking = useRef(false);
  const done = useRef(false);
  const onVerifiedRef = useRef(onVerified);
  const email = getFirebaseAuth().currentUser?.email ?? "ton adresse";

  useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);

  const handleSend = useCallback(async () => {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return;
    setSending(true);
    setMessage(null);
    try {
      auth.languageCode = "fr";
      await sendEmailVerification(user);
      setMessage(
        "Lien envoyé ! Ouvre-le depuis ta boîte mail (pense aux spams), l’invitation sera acceptée toute seule.",
      );
    } catch (err: unknown) {
      setMessage(
        err instanceof FirebaseError && err.code === "auth/too-many-requests"
          ? "Un lien vient déjà de partir. Regarde ta boîte mail (et les spams) avant d’en redemander un."
          : "Impossible d’envoyer le lien pour le moment. Réessaie dans un instant.",
      );
    } finally {
      setSending(false);
    }
  }, []);

  /** Recharge le compte ; si confirmé, rafraîchit le jeton et relance l’acceptation. */
  const refreshVerified = useCallback(async (): Promise<boolean> => {
    const user = getFirebaseAuth().currentUser;
    if (!user) return false;
    await reload(user);
    const refreshed = getFirebaseAuth().currentUser;
    if (!refreshed?.emailVerified) return false;
    await refreshed.getIdToken(true);
    if (!done.current) {
      done.current = true;
      onVerifiedRef.current();
    }
    return true;
  }, []);

  const checkSilently = useCallback(async () => {
    if (checking.current || done.current) return;
    checking.current = true;
    try {
      await refreshVerified();
    } catch {
      // Réseau indisponible : la prochaine vérification réessaiera.
    } finally {
      checking.current = false;
    }
  }, [refreshVerified]);

  useEffect(() => {
    if (autoSent.current) return;
    autoSent.current = true;
    void handleSend();
  }, [handleSend]);

  useEffect(() => {
    const interval = window.setInterval(() => void checkSilently(), VERIFICATION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkSilently();
    };
    const onFocus = () => void checkSilently();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkSilently]);

  async function handleCheck() {
    setBusy(true);
    setMessage(null);
    try {
      if (await refreshVerified()) return;
      setMessage("Ton e-mail n’est pas encore confirmé. Clique sur le lien reçu, puis réessaie.");
    } catch {
      setMessage("Vérification impossible pour le moment. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || sending;

  return (
    <>
      <p className={styles.hint}>
        Pour accepter l’invitation, confirme d’abord que {email} est bien à toi : on
        t’envoie un lien, clique dessus et on s’occupe du reste.
      </p>
      {message ? (
        <p className={styles.hint} role="status">
          {message}
        </p>
      ) : null}
      <div className={deniedStyles.actions}>
        <button
          type="button"
          className={formStyles.submit}
          disabled={disabled}
          onClick={() => void handleCheck()}
        >
          J’ai confirmé mon e-mail
        </button>
        <button
          type="button"
          className={deniedStyles.siteLink}
          disabled={disabled}
          onClick={() => void handleSend()}
        >
          {sending ? "Envoi du lien…" : "Renvoyer le lien"}
        </button>
      </div>
    </>
  );
}
