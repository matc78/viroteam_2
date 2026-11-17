"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { JoinGuardianAccept } from "@/components/auth/JoinGuardianAccept";
import { JoinMemberAccept } from "@/components/auth/JoinMemberAccept";
import { JoinTeamAccept } from "@/components/auth/JoinTeamAccept";
import { joinCopy } from "@/lib/copy/joinCopy";
import {
  lookupFailureCopy,
  type InvitationLookupFailure,
} from "@/lib/invitations/invitationLookupFailure";
import {
  lookupInvitationCode,
  isGuardianInvitation,
  isMemberInvitation,
  isTeamInvitation,
  type InvitationLookupResult,
} from "@/lib/firebase/invitationService";
import deniedStyles from "@/components/auth/AccessDenied.module.css";
import formStyles from "@/components/auth/AuthForm.module.css";
import styles from "@/components/auth/JoinOnboardingForm.module.css";

/** Accepte une invitation parent, membre ou code d’équipe sur le portail. */
export function JoinRedirectClient() {
  const searchParams = useSearchParams();
  const invitationCode = (searchParams.get("code") ?? "").trim().toUpperCase();
  const [invitation, setInvitation] = useState<InvitationLookupResult | null>(
    null,
  );
  const [failure, setFailure] = useState<InvitationLookupFailure | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  /** Incrémenté par « Réessayer » après une erreur technique. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!invitationCode) {
      setInvitation(null);
      setFailure(null);
      setLookupDone(true);
      return;
    }

    let cancelled = false;
    setLookupDone(false);

    void lookupInvitationCode(invitationCode).then((lookup) => {
      if (cancelled) return;
      setInvitation(lookup.ok ? lookup.invitation : null);
      setFailure(lookup.ok ? null : lookup.failure);
      setLookupDone(true);
    });

    return () => {
      cancelled = true;
    };
  }, [invitationCode, attempt]);

  if (!invitationCode) {
    return (
      <AuthShell
        accent="cyan"
        eyebrow="Rejoindre un club"
        title={joinCopy.lookupMissingCodeTitle}
        lead={joinCopy.lookupMissingCodeLead}
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
    const failureCopy = lookupFailureCopy(failure ?? "notFound");
    return (
      <AuthShell
        accent="cyan"
        eyebrow="Rejoindre un club"
        title={failureCopy.title}
        lead={failureCopy.lead}
      >
        {failure === "error" ? (
          <div className={deniedStyles.actions}>
            <button
              type="button"
              className={formStyles.submit}
              onClick={() => setAttempt((count) => count + 1)}
            >
              {joinCopy.lookupRetry}
            </button>
          </div>
        ) : (
          <p className={styles.hint}>{joinCopy.lookupSignInHint}</p>
        )}
      </AuthShell>
    );
  }

  if (isGuardianInvitation(invitation)) {
    return <JoinGuardianAccept invitation={invitation} />;
  }

  if (isTeamInvitation(invitation)) {
    return <JoinTeamAccept invitation={invitation} />;
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
