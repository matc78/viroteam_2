"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { linkGuardian } from "@/lib/firebase/callableService";
import type { InvitationLookupResult } from "@/lib/firebase/invitationService";
import deniedStyles from "./AccessDenied.module.css";
import styles from "./JoinOnboardingForm.module.css";

type JoinGuardianAcceptProps = {
  invitation: InvitationLookupResult;
};

/**
 * Accepte une invitation parent sur le portail (pas de redirection app).
 */
export function JoinGuardianAccept({ invitation }: JoinGuardianAcceptProps) {
  const { status, refreshProfile } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== "signedIn") return;

    let cancelled = false;
    setBusy(true);
    void linkGuardian({
      clubId: invitation.clubId,
      invitationId: invitation.invitationId,
    })
      .then(async () => {
        await refreshProfile();
        if (!cancelled) router.replace("/family");
      })
      .catch(async (err: unknown) => {
        if (cancelled) return;
        await refreshProfile();
        const message =
          err instanceof Error
            ? err.message
            : "Impossible d’activer le suivi parent.";
        if (/déjà|traitée|active/i.test(message)) {
          router.replace("/family");
          return;
        }
        setError(message);
        setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [invitation.clubId, invitation.invitationId, refreshProfile, router, status]);

  const loginHref = `/login?next=${encodeURIComponent(`/join?code=${invitation.code}`)}`;
  const signupHref = `/signup?next=${encodeURIComponent(`/join?code=${invitation.code}`)}`;

  if (status === "signedOut") {
    return (
      <AuthShell
        accent="cyan"
        eyebrow="Espace famille"
        title={`Suivre ${invitation.clubName}`}
        lead="Tu pourras voir le planning, répondre aux convocations et payer la cotisation. Connecte-toi avec l’e-mail invité."
      >
        <div className={deniedStyles.actions}>
          <Link href={loginHref} className={deniedStyles.submitLink}>
            Se connecter
          </Link>
          <Link href={signupHref} className={deniedStyles.siteLink}>
            Créer un compte
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      accent="cyan"
      eyebrow="Espace famille"
      title="Activation du suivi"
      lead={
        busy
          ? `On rattache ton compte à ${invitation.clubName}…`
          : error ?? "Suivi parent."
      }
    >
      {error ? (
        <p className={styles.hint} role="alert">
          {error}
        </p>
      ) : (
        <p className={styles.hint}>Un instant.</p>
      )}
    </AuthShell>
  );
}
