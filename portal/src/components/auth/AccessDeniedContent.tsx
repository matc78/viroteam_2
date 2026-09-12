"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { JoinOnboardingForm } from "@/components/auth/JoinOnboardingForm";
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

/** Écran accès limité — onboarding join (acceptation web) si pas de club. */
export function AccessDeniedContent() {
  const { logout, status, profile, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSignup = searchParams.get("from") === "signup";
  const reason = searchParams.get("reason");
  const forceAppMessage = reason === "unknown" || reason === "role";
  const [clubNames, setClubNames] = useState<string[]>([]);

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
    const fromProfile = profile?.firstName?.trim();
    if (fromProfile) return fromProfile;
    return splitDisplayName(profile?.displayName ?? "").firstName;
  }, [profile]);

  const accountDisplayName = useMemo(() => {
    const displayName = profile?.displayName?.trim();
    if (displayName) return displayName;
    const composed = [profile?.firstName, profile?.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ");
    if (composed) return composed;
    return user?.displayName?.trim() || "";
  }, [profile, user]);

  const accountEmail =
    profile?.email?.trim() || user?.email?.trim() || "";

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
    router.replace("/login");
  }

  return (
    <AuthShell accent="orange" eyebrow="Accès limité" title={title} lead={lead}>
      <div className={styles.body}>
        {status === "signedIn" && (accountDisplayName || accountEmail) ? (
          <div className={styles.accountCard} aria-live="polite">
            <p className={styles.accountLabel}>Connecté avec</p>
            {accountDisplayName ? (
              <p className={styles.accountName}>{accountDisplayName}</p>
            ) : null}
            {accountEmail ? (
              <p className={styles.accountEmail}>{accountEmail}</p>
            ) : null}
          </div>
        ) : null}

        {needsJoinOnboarding ? (
          <JoinOnboardingForm />
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
