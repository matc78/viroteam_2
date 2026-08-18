"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  JoinOnboardingForm,
  JoinOnboardingSuccess,
} from "@/components/auth/JoinOnboardingForm";
import { StoreBadges } from "@/components/StoreBadges";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { GuardianStatuses } from "@/lib/firebase/constants";
import {
  buildAccessDeniedLead,
  buildAccessDeniedTitle,
  buildJoinOnboardingLead,
} from "@/lib/firebase/accessDeniedMessage";
import { getClubsByIds } from "@/lib/firebase/clubService";
import { splitDisplayName } from "@/lib/firebase/types";
import { site } from "@/lib/site";
import formStyles from "./AuthForm.module.css";
import styles from "./AccessDenied.module.css";

/** Écran réservé aux admins — onboarding join si pas de club. */
export function AccessDeniedContent() {
  const { logout, status, profile } = useAuth();
  const searchParams = useSearchParams();
  const fromSignup = searchParams.get("from") === "signup";
  const [clubNames, setClubNames] = useState<string[]>([]);
  const [joinCompleted, setJoinCompleted] = useState<{
    clubName: string;
    code: string;
  } | null>(null);

  const hasClubs = (profile?.clubMemberships.length ?? 0) > 0;
  const isParent = (profile?.parentLinks ?? []).some(
    (link) => link.status === GuardianStatuses.active,
  );
  const needsJoinOnboarding = status === "signedIn" && !hasClubs && !isParent;

  useEffect(() => {
    const clubIds =
      profile?.clubMemberships.map((membership) => membership.clubId) ?? [];
    if (clubIds.length === 0) {
      setClubNames([]);
      return;
    }

    let cancelled = false;
    void getClubsByIds(clubIds).then((clubs) => {
      if (cancelled) return;
      setClubNames(clubs.map((club) => club.name).filter(Boolean));
    });

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const firstName = useMemo(() => {
    const fromProfile = profile?.firstName?.trim();
    if (fromProfile) return fromProfile;
    return splitDisplayName(profile?.displayName ?? "").firstName;
  }, [profile]);

  const title = buildAccessDeniedTitle({ fromSignup, needsJoinOnboarding });
  const lead = needsJoinOnboarding
    ? buildJoinOnboardingLead(firstName)
    : buildAccessDeniedLead({
        firstName,
        clubNames,
        fromSignup,
      });

  async function handleLogout() {
    await logout();
  }

  return (
    <AuthShell accent="orange" eyebrow="Accès limité" title={title} lead={lead}>
      <div className={styles.body}>
        {needsJoinOnboarding ? (
          joinCompleted ? (
            <JoinOnboardingSuccess
              firstName={firstName}
              clubName={joinCompleted.clubName}
              code={joinCompleted.code}
            />
          ) : (
            <JoinOnboardingForm onCompleted={setJoinCompleted} />
          )
        ) : (
          <>
            <p className={styles.appHint}>Télécharge l’app pour continuer :</p>
            <StoreBadges className={styles.stores} />
          </>
        )}

        <div className={styles.actions}>
          {status === "signedIn" ? (
            <button
              type="button"
              className={formStyles.submit}
              onClick={() => void handleLogout()}
            >
              Se déconnecter
            </button>
          ) : (
            <Link href="/login" className={styles.submitLink}>
              Se connecter
            </Link>
          )}
          <Link href="/" className={styles.siteLink}>
            Retour au site {site.name}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
