"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { StoreBadges } from "@/components/StoreBadges";
import { appJoinDeepLink } from "@/lib/site";
import styles from "./JoinOnboardingForm.module.css";

type JoinAppRedirectProps = {
  code: string;
  clubName?: string | null;
  /** Message personnalisé au-dessus du badge code. */
  successMessage?: ReactNode;
  /** Affiche le lien vers le login portail. */
  showPortalLoginLink?: boolean;
  /** Tente l’ouverture automatique de l’app au montage. */
  autoOpenApp?: boolean;
};

/**
 * Bloc de redirection vers l’app mobile : badge code, bouton deep link, stores.
 */
export function JoinAppRedirect({
  code,
  clubName,
  successMessage,
  showPortalLoginLink = false,
  autoOpenApp = true,
}: JoinAppRedirectProps) {
  const [showFallback, setShowFallback] = useState(!autoOpenApp);
  const deepLink = appJoinDeepLink(code);

  useEffect(() => {
    if (!autoOpenApp || !code) return;

    window.location.href = deepLink;
    const timer = window.setTimeout(() => setShowFallback(true), 1600);
    return () => window.clearTimeout(timer);
  }, [autoOpenApp, code, deepLink]);

  return (
    <div className={styles.successBox}>
      {successMessage ? (
        <p className={styles.successLead}>{successMessage}</p>
      ) : null}

      <span className={styles.codeBadge} aria-label="Code d’invitation">
        {code}
      </span>

      {showFallback || !autoOpenApp ? (
        <>
          <a className={styles.openAppButton} href={deepLink}>
            Ouvrir l’app ViroTeam
          </a>
          <StoreBadges />
          <p className={styles.hint}>
            {clubName
              ? `Pas encore l’app ? Installe-la puis saisis le code ci-dessus pour rejoindre ${clubName}.`
              : "Pas encore l’app ? Installe-la puis saisis le code ci-dessus dans « Rejoindre un club »."}
          </p>
          {showPortalLoginLink ? (
            <Link href="/login" className={styles.hint}>
              Se connecter sur le portail
            </Link>
          ) : null}
        </>
      ) : (
        <p className={styles.hint}>Ouverture de l’application…</p>
      )}
    </div>
  );
}
