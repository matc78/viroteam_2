"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { AuthShell } from "@/components/auth/AuthShell";
import { isInvitationAlreadyProcessed } from "@/lib/auth/invitationAcceptErrors";
import { joinCopy } from "@/lib/copy/joinCopy";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { InvitationTypes } from "@/lib/firebase/constants";
import type { InvitationLookupResult } from "@/lib/firebase/invitationService";
import { acceptLookupInvitation } from "@/lib/firebase/invitationService";
import { splitDisplayName } from "@/lib/firebase/types";
import { updateUserProfileForJoin } from "@/lib/firebase/userService";
import {
  firstNameError,
  lastNameError,
} from "@/lib/format/personDataFormat";
import deniedStyles from "./AccessDenied.module.css";
import styles from "./JoinOnboardingForm.module.css";

type JoinTeamAcceptProps = {
  invitation: InvitationLookupResult & {
    type: typeof InvitationTypes.team;
  };
};

/**
 * Accepte un code d’équipe multi-usage sur le portail.
 */
export function JoinTeamAccept({ invitation }: JoinTeamAcceptProps) {
  const { status, user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const userRef = useRef(user);
  const profileRef = useRef(profile);
  userRef.current = user;
  profileRef.current = profile;

  const teamLabel = invitation.teamName?.trim() || joinCopy.teamFallback;

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
            currentProfile?.firstName?.trim() || split.firstName;
          const lastName = currentProfile?.lastName?.trim() || split.lastName;

          if (!firstNameError(firstName) && !lastNameError(lastName)) {
            await updateUserProfileForJoin({
              uid: currentUser.uid,
              email: currentUser.email,
              firstName,
              lastName,
            });
          }
        }

        await acceptLookupInvitation({
          invitationId: invitation.invitationId,
          clubId: invitation.clubId,
          code: invitation.code,
          role: invitation.role,
          type: invitation.type,
          memberId: invitation.memberId,
          clubName: invitation.clubName,
          teamId: invitation.teamId,
          teamName: invitation.teamName,
        });
        await refreshProfile();
        if (!cancelled) router.replace("/home");
      } catch (err: unknown) {
        if (cancelled) return;
        await refreshProfile();
        const message =
          err instanceof Error
            ? err.message
            : joinCopy.inviteAcceptFailed;
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
    invitation.clubName,
    invitation.code,
    invitation.invitationId,
    invitation.memberId,
    invitation.role,
    invitation.teamId,
    invitation.teamName,
    invitation.type,
    refreshProfile,
    router,
    status,
  ]);

  const joinPath = `/join?code=${invitation.code}`;
  const loginHref = `/login?next=${encodeURIComponent(joinPath)}`;
  const signupHref = `/signup?next=${encodeURIComponent(joinPath)}`;

  if (status === "loading") {
    return <AuthLoadingState message="Vérification de ta session…" />;
  }

  if (status === "signedOut") {
    return (
      <AuthShell
        accent="cyan"
        eyebrow={joinCopy.joinTeamEyebrow}
        title={joinCopy.joinTeamTitle(teamLabel)}
        lead={joinCopy.joinTeamLead(teamLabel, invitation.clubName)}
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

  if (busy && !error) {
    return (
      <AuthLoadingState message={joinCopy.acceptingTeam(teamLabel)} />
    );
  }

  return (
    <AuthShell
      accent="cyan"
      eyebrow={joinCopy.joinTeamEyebrow}
      title={joinCopy.validatingInviteTitle}
      lead={error ?? joinCopy.teamInviteFallbackLead}
    >
      {error ? (
        <p className={styles.hint} role="alert">
          {error}
        </p>
      ) : null}
    </AuthShell>
  );
}
