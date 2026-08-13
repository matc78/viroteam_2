"use client";

import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { FeesConfigForm } from "@/components/dashboard/FeesConfigForm";
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
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";

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

  if (loading && !config) {
    return <DashboardSkeleton variant="fees" />;
  }

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace club"
        heading="Cotisations"
        lead={`Configurez la saison, les tarifs et le paiement en ligne HelloAsso pour ${activeClub?.name ?? "votre club"}.`}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {config && user && activeClub ? (
        <FeesConfigForm
          key={activeClub.id}
          initial={config}
          clubId={activeClub.id}
          uid={user.uid}
          onSaved={() => {
            void refreshProfile().then(reload);
          }}
        />
      ) : null}
    </div>
  );
}
