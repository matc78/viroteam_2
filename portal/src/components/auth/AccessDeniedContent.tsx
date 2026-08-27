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

const ACCESS_DENIED_FIRST_NAME_KEY = "viro.accessDeniedFirstName";

function readStoredAccessDeniedFirstName(): string {
  if (typeof window === "undefined") return "";
  try {
    const value = sessionStorage.getItem(ACCESS_DENIED_FIRST_NAME_KEY)?.trim();
    if (value) sessionStorage.removeItem(ACCESS_DENIED_FIRST_NAME_KEY);
    return value ?? "";
  } catch {
    return "";
  }
}

/** Écran réservé aux admins — onboarding join si pas de club. */
export function AccessDeniedContent() {
  const { logout, status, profile } = useAuth();
  const searchParams = useSearchParams();
  const fromSignup = searchParams.get("from") === "signup";
  const reason = searchParams.get("reason");
  const forceAppMessage = reason === "unknown" || reason === "role";
  const [storedFirstName] = useState(readStoredAccessDeniedFirstName);
  const [clubNames, setClubNames] = useState<string[]>([]);
  const [joinCompleted, setJoinCompleted] = useState<{
    clubName: string;
    code: string;
  } | null>(null);

  const hasClubs = (profile?.clubMemberships.length ?? 0) > 0;
  const isParent = (profile?.parentLinks ?? []).some(
    (link) => link.status === GuardianStatuses.active,
  );
  const needsJoinOnboarding =
    status === "signedIn" && !hasClubs && !isParent && !forceAppMessage;

  useEffect(() => {
    if (forceAppMessage) {
      setClubNames([]);
      return;
    }
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
  }, [profile, forceAppMessage]);

  const firstName = useMemo(() => {
    if (forceAppMessage) return storedFirstName;
    const fromProfile = profile?.firstName?.trim();
    if (fromProfile) return fromProfile;
    return splitDisplayName(profile?.displayName ?? "").firstName;
  }, [profile, forceAppMessage, storedFirstName]);

  const title = buildAccessDeniedTitle({
    fromSignup,
    needsJoinOnboarding,
    forceAppMessage,
  });
  const lead = needsJoinOnboarding
    ? buildJoinOnboardingLead(firstName)
    : buildAccessDeniedLead({
        firstName,
        clubNames,
        fromSignup,
        forceAppMessage,
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
          {status === "signedIn" && !forceAppMessage ? (
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
