"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { JoinAppRedirect } from "@/components/auth/JoinAppRedirect";
import { findInvitationByCode } from "@/lib/firebase/invitationService";
import styles from "@/components/auth/JoinOnboardingForm.module.css";

/** Tente d’ouvrir l’app avec un code d’invitation. */
export function JoinRedirectClient() {
  const searchParams = useSearchParams();
  const invitationCode = (searchParams.get("code") ?? "").trim().toUpperCase();
  const [clubName, setClubName] = useState<string | null>(null);

  useEffect(() => {
    if (!invitationCode) return;

    void findInvitationByCode(invitationCode)
      .then((invitation) => {
        if (invitation) setClubName(invitation.clubName);
      })
      .catch(() => {});
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

  return (
    <AuthShell
      accent="cyan"
      eyebrow="Rejoindre un club"
      title="Ouvre l’app ViroTeam"
      lead={
        clubName
          ? `On t’envoie vers ${clubName} dans l’app.`
          : "On t’envoie vers l’app ViroTeam avec ton code d’invitation."
      }
    >
      <JoinAppRedirect
        code={invitationCode}
        clubName={clubName}
        showPortalLoginLink
      />
    </AuthShell>
  );
}
