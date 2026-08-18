"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { JoinAppRedirect } from "@/components/auth/JoinAppRedirect";
import { JoinGuardianAccept } from "@/components/auth/JoinGuardianAccept";
import {
  findInvitationByCode,
  type InvitationLookupResult,
} from "@/lib/firebase/invitationService";
import { InvitationTypes } from "@/lib/firebase/constants";
import styles from "@/components/auth/JoinOnboardingForm.module.css";

/** Tente d’ouvrir l’app (membre) ou d’accepter un lien parent sur le portail. */
export function JoinRedirectClient() {
  const searchParams = useSearchParams();
  const invitationCode = (searchParams.get("code") ?? "").trim().toUpperCase();
  const [invitation, setInvitation] = useState<InvitationLookupResult | null>(
    null,
  );
  const [lookupDone, setLookupDone] = useState(false);

  useEffect(() => {
    if (!invitationCode) {
      setLookupDone(true);
      return;
    }

    void findInvitationByCode(invitationCode)
      .then((found) => {
        setInvitation(found);
      })
      .catch(() => {
        setInvitation(null);
      })
      .finally(() => setLookupDone(true));
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

  if (invitation?.type === InvitationTypes.guardian) {
    return <JoinGuardianAccept invitation={invitation} />;
  }

  return (
    <AuthShell
      accent="cyan"
      eyebrow="Rejoindre un club"
      title="Ouvre l’app ViroTeam"
      lead={
        invitation?.clubName
          ? `On t’envoie vers ${invitation.clubName} dans l’app.`
          : "On t’envoie vers l’app ViroTeam avec ton code d’invitation."
      }
    >
      <JoinAppRedirect
        code={invitationCode}
        clubName={invitation?.clubName ?? null}
        showPortalLoginLink
      />
    </AuthShell>
  );
}
