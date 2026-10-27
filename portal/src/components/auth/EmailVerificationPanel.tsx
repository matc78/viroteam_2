"use client";

import { reload, sendEmailVerification } from "firebase/auth";
import { useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/app";
import deniedStyles from "./AccessDenied.module.css";
import formStyles from "./AuthForm.module.css";
import styles from "./JoinOnboardingForm.module.css";

type EmailVerificationPanelProps = {
  /** Appelé une fois l’adresse confirmée (jeton rafraîchi) : relance l’acceptation. */
  onVerified: () => void;
};

/**
 * Demande de confirmer l’adresse e-mail avant d’accepter une invitation
 * (refus `email_not_verified` des Functions). Miroir de
 * `showEmailVerificationDialog` côté app.
 */
export function EmailVerificationPanel({ onVerified }: EmailVerificationPanelProps) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const email = getFirebaseAuth().currentUser?.email ?? "ton adresse";

  async function handleSend() {
    const user = getFirebaseAuth().currentUser;
    if (!user) return;
    setBusy(true);
    setMessage(null);
    try {
      await sendEmailVerification(user);
      setSent(true);
      setMessage("Lien envoyé, jette un œil à ta boîte mail.");
    } catch {
      setMessage("Impossible d’envoyer le lien pour le moment. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCheck() {
    const user = getFirebaseAuth().currentUser;
    if (!user) return;
    setBusy(true);
    setMessage(null);
    try {
      await reload(user);
      const refreshed = getFirebaseAuth().currentUser;
      if (refreshed?.emailVerified) {
        await refreshed.getIdToken(true);
        onVerified();
        return;
      }
      setMessage("Ton e-mail n’est pas encore confirmé. Clique sur le lien reçu, puis réessaie.");
    } catch {
      setMessage("Vérification impossible pour le moment. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className={styles.hint}>
        Pour accepter l’invitation, confirme d’abord que {email} est bien à toi :
        clique sur le lien qu’on t’envoie, puis reviens ici.
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
          disabled={busy}
          onClick={() => void handleCheck()}
        >
          J’ai confirmé mon e-mail
        </button>
        <button
          type="button"
          className={deniedStyles.siteLink}
          disabled={busy}
          onClick={() => void handleSend()}
        >
          {sent ? "Renvoyer le lien" : "Envoyer le lien de confirmation"}
        </button>
      </div>
    </>
  );
}
