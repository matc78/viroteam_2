"use client";

import { useState } from "react";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { FeesConfigForm } from "@/components/dashboard/FeesConfigForm";
import { FeesTrackingPanel } from "@/components/dashboard/FeesTrackingPanel";
import {
  emptyFeesConfig,
  FeesConfig,
  seasonRecordToFeesConfig,
} from "@/lib/dashboard/feesConfig";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import type { ClubRecord } from "@/lib/firebase/clubService";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getActiveSeason } from "@/lib/firebase/feeService";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import tabStyles from "@/components/dashboard/MembersTabs.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";

type FeesTab = "config" | "tracking";

/** Charge la config cotisations depuis la saison active du club. */
async function loadFeesConfigForClub(club: ClubRecord): Promise<FeesConfig> {
  const season = await getActiveSeason(club.id);
  if (!season) {
    return emptyFeesConfig({
      onlinePaymentEnabled: club.onlinePaymentEnabled,
      helloAssoOrganizationSlug: club.helloAssoOrganizationSlug,
      seasonEndDate: club.seasonEndDate,
    });
  }
  return seasonRecordToFeesConfig(season, club);
}

/** Contenu page Cotisations branché sur Firestore. */
export function FeesPageClient() {
  const { activeClub, user, refreshProfile } = useAuth();
  const { data: config, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub,
    loadFeesConfigForClub,
    [],
  );
  const [tab, setTab] = useState<FeesTab>("config");

  if (loading && !config) {
    return <DashboardSkeleton variant="fees" />;
  }

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace club"
        heading="Cotisations"
        lead={`Configurez la saison et suivez les paiements de ${activeClub?.name ?? "votre club"}.`}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {config && user && activeClub ? (
        <>
          <div className={tabStyles.tabs} role="tablist" aria-label="Cotisations">
            <button
              type="button"
              role="tab"
              id="fees-tab-config"
              aria-selected={tab === "config"}
              aria-controls="fees-panel-config"
              className={`${tabStyles.tab} ${tab === "config" ? tabStyles.tabActive : ""}`}
              onClick={() => setTab("config")}
            >
              Configuration
            </button>
            <button
              type="button"
              role="tab"
              id="fees-tab-tracking"
              aria-selected={tab === "tracking"}
              aria-controls="fees-panel-tracking"
              className={`${tabStyles.tab} ${tab === "tracking" ? tabStyles.tabActive : ""}`}
              onClick={() => setTab("tracking")}
            >
              Suivi
            </button>
          </div>

          {tab === "config" ? (
            <div
              id="fees-panel-config"
              role="tabpanel"
              aria-labelledby="fees-tab-config"
            >
              <FeesConfigForm
                key={activeClub.id}
                initial={config}
                clubId={activeClub.id}
                uid={user.uid}
                onSaved={() => {
                  void refreshProfile().then(reload);
                }}
              />
            </div>
          ) : (
            <div
              id="fees-panel-tracking"
              role="tabpanel"
              aria-labelledby="fees-tab-tracking"
            >
              <FeesTrackingPanel key={activeClub.id} club={activeClub} />
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
