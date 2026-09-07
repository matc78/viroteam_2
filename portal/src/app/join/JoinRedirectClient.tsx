"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { JoinGuardianAccept } from "@/components/auth/JoinGuardianAccept";
import { JoinMemberAccept } from "@/components/auth/JoinMemberAccept";
import {
  findInvitationByCode,
  isGuardianInvitation,
  isMemberInvitation,
  type InvitationLookupResult,
} from "@/lib/firebase/invitationService";
import styles from "@/components/auth/JoinOnboardingForm.module.css";

/** Accepte une invitation parent ou membre (joueur / coach) sur le portail. */
export function JoinRedirectClient() {
  const searchParams = useSearchParams();
  const invitationCode = (searchParams.get("code") ?? "").trim().toUpperCase();
  const [invitation, setInvitation] = useState<InvitationLookupResult | null>(
    null,
  );
  const [lookupDone, setLookupDone] = useState(false);

  useEffect(() => {
    if (!invitationCode) {
      setInvitation(null);
      setLookupDone(true);
      return;
    }

    let cancelled = false;
    setLookupDone(false);

    void findInvitationByCode(invitationCode)
      .then((found) => {
        if (!cancelled) setInvitation(found);
      })
      .catch(() => {
        if (!cancelled) setInvitation(null);
      })
      .finally(() => {
        if (!cancelled) setLookupDone(true);
      });

    return () => {
      cancelled = true;
    };
  }, [invitationCode]);

  if (!invitationCode) {
    return (
      <AuthShell
        accent="cyan"
        eyebrow="Rejoindre un club"
        title="Code manquant"
        lead="Demande ton code d’invitation à l’admin ou à ton entraîneur, puis réessaie."
      >
        <p className={styles.hint}>
          Tu peux aussi te connecter sur le portail pour compléter ton profil.
        </p>
      </AuthShell>
    );
  }

  if (!lookupDone) {
    return (
      <AuthShell
        accent="cyan"
        eyebrow="Invitation"
        title="Vérification du code"
        lead="On cherche ton invitation…"
      >
        <p className={styles.hint}>Un instant.</p>
      </AuthShell>
    );
  }

  if (!invitation) {
    return (
      <AuthShell
        accent="cyan"
        eyebrow="Rejoindre un club"
        title="Code introuvable"
        lead="Ce code est invalide ou a expiré. Demande un nouveau code à ton club."
      >
        <p className={styles.hint}>
          Tu peux te connecter sur le portail si tu as déjà un compte.
        </p>
      </AuthShell>
    );
  }

  if (isGuardianInvitation(invitation)) {
    return <JoinGuardianAccept invitation={invitation} />;
  }

  if (isMemberInvitation(invitation)) {
    return <JoinMemberAccept invitation={invitation} />;
  }

  return (
    <AuthShell
      accent="cyan"
      eyebrow="Rejoindre un club"
      title="Invitation non supportée"
      lead="Ce type d’invitation ne peut pas être traité sur le portail."
    >
      <p className={styles.hint}>Demande un nouveau lien à ton club.</p>
    </AuthShell>
  );
}
