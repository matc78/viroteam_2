"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { isInvitationAlreadyProcessed } from "@/lib/auth/invitationAcceptErrors";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { acceptInvitation } from "@/lib/firebase/callableService";
import { MemberRoles, InvitationTypes } from "@/lib/firebase/constants";
import type {
  InvitationLookupResult,
  InvitationMemberRole,
} from "@/lib/firebase/invitationService";
import { splitDisplayName } from "@/lib/firebase/types";
import { updateUserProfileForJoin } from "@/lib/firebase/userService";
import deniedStyles from "./AccessDenied.module.css";
import styles from "./JoinOnboardingForm.module.css";

type JoinMemberAcceptProps = {
  invitation: InvitationLookupResult & {
    type: typeof InvitationTypes.member;
  };
};

/** Libellé rôle pour le copy d’invitation membre. */
function memberRoleLabel(role: InvitationMemberRole): string {
  if (role === MemberRoles.coach) return "entraîneur";
  if (role === MemberRoles.admin) return "admin";
  return "joueur";
}

/**
 * Accepte une invitation joueur / coach sur le portail (même callable que l’app).
 */
export function JoinMemberAccept({ invitation }: JoinMemberAcceptProps) {
  const { status, user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const roleLabel = memberRoleLabel(invitation.role);
  const userRef = useRef(user);
  const profileRef = useRef(profile);
  userRef.current = user;
  profileRef.current = profile;

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "signedIn") return;

    let cancelled = false;
    setBusy(true);
    setError(null);

    void (async () => {
      try {
        const currentUser = userRef.current;
        const currentProfile = profileRef.current;

        if (currentUser?.email) {
          const split = splitDisplayName(currentProfile?.displayName ?? "");
          const firstName =
            currentProfile?.firstName?.trim() ||
            invitation.firstName?.trim() ||
            split.firstName;
          const lastName =
            currentProfile?.lastName?.trim() ||
            invitation.lastName?.trim() ||
            split.lastName;

          if (firstName.length >= 2 && lastName.length >= 2) {
            await updateUserProfileForJoin({
              uid: currentUser.uid,
              email: currentUser.email,
              firstName,
              lastName,
            });
          }
        }

        await acceptInvitation({
          clubId: invitation.clubId,
          invitationId: invitation.invitationId,
        });
        await refreshProfile();
        if (!cancelled) router.replace("/home");
      } catch (err: unknown) {
        if (cancelled) return;
        await refreshProfile();
        const message =
          err instanceof Error
            ? err.message
            : "Impossible d’accepter l’invitation.";
        if (isInvitationAlreadyProcessed(message)) {
          router.replace("/home");
          return;
        }
        setError(message);
        setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    invitation.clubId,
    invitation.firstName,
    invitation.invitationId,
    invitation.lastName,
    refreshProfile,
    router,
    status,
  ]);

  const joinPath = `/join?code=${invitation.code}`;
  const loginHref = `/login?next=${encodeURIComponent(joinPath)}`;
  const signupHref = `/signup?next=${encodeURIComponent(joinPath)}`;

  if (status === "loading") {
    return (
      <AuthShell
        accent="cyan"
        eyebrow="Rejoindre un club"
        title="Validation de l’invitation"
        lead="Vérification de ta session…"
      >
        <p className={styles.hint}>Un instant.</p>
      </AuthShell>
    );
  }

  if (status === "signedOut") {
    return (
      <AuthShell
        accent="cyan"
        eyebrow="Rejoindre un club"
        title={`Rejoindre ${invitation.clubName}`}
        lead={`Tu es invité·e en tant que ${roleLabel}. Connecte-toi avec l’e-mail invité pour valider ton entrée dans l’équipe.`}
      >
        <div className={deniedStyles.actions}>
          <Link href={loginHref} className={deniedStyles.submitLink}>
            Se connecter
          </Link>
          <Link href={signupHref} className={deniedStyles.siteLink}>
            Créer un compte
          </Link>
        </div>
        {invitation.emailHint ? (
          <p className={styles.hint}>
            Invitation destinée à {invitation.emailHint}
          </p>
        ) : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      accent="cyan"
      eyebrow="Rejoindre un club"
      title="Validation de l’invitation"
      lead={
        busy
          ? `On t’ajoute à ${invitation.clubName}…`
          : (error ?? "Invitation membre.")
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
