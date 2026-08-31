"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { PortalButton } from "@/components/common/PortalButton";
import { AuthPageIntro } from "@/components/auth/AuthPageIntro";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SetupSportProgress } from "@/components/clubSetup/SetupSportProgress";
import { clubSetupStepAccent } from "@/lib/clubSetup/clubSetupStepAccents";
import authFormStyles from "@/components/auth/AuthForm.module.css";
import styles from "./ClubSetupShell.module.css";

const easeOut = [0.22, 1, 0.36, 1] as [number, number, number, number];

type ClubSetupShellProps = {
  eyebrow: string;
  title: string;
  lead: string;
  currentStep: number;
  stepKey: string;
  previewBanner?: boolean;
  resumeBanner?: boolean;
  errorMessage?: string | null;
  onStepSelect?: (step: number) => void;
  nextLabel: string;
  canProceed: boolean;
  submitting: boolean;
  onNext: () => void;
  /** Corps court (ex. prérequis) : pas d’étirement vertical avant le footer. */
  compactBody?: boolean;
  /** Étapes denses (identité, objectifs…) : panneau élargi et intro compacte. */
  wideLayout?: boolean;
  children: ReactNode;
};

/** Coquille wizard création club — même langage visuel que login / signup. */
export function ClubSetupShell({
  eyebrow,
  title,
  lead,
  currentStep,
  stepKey,
  previewBanner,
  resumeBanner,
  errorMessage,
  onStepSelect,
  nextLabel,
  canProceed,
  submitting,
  onNext,
  compactBody = false,
  wideLayout = false,
  children,
}: ClubSetupShellProps) {
  const prefersReducedMotion = useReducedMotion();
  const stepAccent = clubSetupStepAccent(currentStep);

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main
        className={[
          styles.main,
          compactBody ? styles.mainCompact : "",
          wideLayout ? styles.mainWide : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <SetupSportProgress
          currentStep={currentStep}
          onStepSelect={onStepSelect}
          wide={wideLayout}
        />
        <div
          className={[
            styles.wizardStack,
            compactBody ? styles.wizardStackCompact : "",
            wideLayout ? styles.wizardStackWide : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={[
              styles.panel,
              compactBody ? styles.panelCompact : "",
              wideLayout ? styles.panelWide : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ ["--step-accent" as string]: stepAccent } as React.CSSProperties}
          >
          {previewBanner ? (
            <p className={styles.previewBanner} role="status">
              Aperçu UI (dev) — parcours libre, création de club désactivée.
            </p>
          ) : null}

          {resumeBanner ? (
            <p className={styles.resumeBanner} role="status">
              Reprise de votre création en cours
            </p>
          ) : null}

          <AuthPageIntro
            eyebrow={eyebrow}
            title={title}
            lead={lead}
            compact
            dense={wideLayout}
          />

          {errorMessage ? (
            <p className={authFormStyles.error} role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div
            className={[
              styles.panelBody,
              compactBody ? styles.panelBodyCompact : "",
              wideLayout ? styles.panelBodyWide : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={stepKey}
                className={styles.stepContent}
                initial={
                  prefersReducedMotion ? false : { opacity: 0, y: 10 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{ duration: 0.24, ease: easeOut }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>

          <div
            className={[
              styles.actions,
              styles.actionsSingle,
              compactBody ? styles.actionsCompact : "",
              wideLayout ? styles.actionsWide : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <PortalButton
              onClick={onNext}
              disabled={!canProceed}
              loading={submitting}
            >
              {nextLabel}
            </PortalButton>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/** État de chargement aligné sur la coquille auth. */
export function ClubSetupLoadingShell() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <p className={styles.loadingText}>Chargement…</p>
      </main>
    </div>
  );
}
