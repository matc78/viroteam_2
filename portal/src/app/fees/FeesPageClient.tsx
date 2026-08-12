"use client";

import { DashboardGuard } from "@/components/auth/DashboardGuard";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
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

/** Charge la config cotisations depuis la saison active du club. */
async function loadFeesConfigForClub(club: ClubRecord): Promise<FeesConfig> {
  const season = await getActiveSeason(club.id);
  if (!season) {
    return emptyFeesConfig({
      onlinePaymentEnabled: club.onlinePaymentEnabled,
      helloAssoOrganizationSlug: club.helloAssoOrganizationSlug,
    });
  }
  return seasonRecordToFeesConfig(season, club);
}

/** Contenu page Cotisations branché sur Firestore. */
function FeesPageContent() {
  const { activeClub, user, refreshProfile } = useAuth();
  const { data: config, loading, error, reload } = useAsyncClubResource(
    activeClub,
    loadFeesConfigForClub,
    [],
  );

  return (
    <DashboardShell>
      <DashboardPageIntro
        eyebrow="Espace club"
        heading="Cotisations"
        lead={`Configurez la saison, les tarifs et le paiement en ligne HelloAsso pour ${activeClub?.name ?? "votre club"}.`}
      />

      {loading ? <p className={introStyles.lead}>Chargement…</p> : null}
      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {config && !loading && user && activeClub ? (
        <FeesConfigForm
          initial={config}
          clubId={activeClub.id}
          uid={user.uid}
          onSaved={() => {
            void refreshProfile().then(reload);
          }}
        />
      ) : null}
    </DashboardShell>
  );
}

/** Client cotisations + garde admin. */
export function FeesPageClient() {
  return (
    <DashboardGuard>
      <FeesPageContent />
    </DashboardGuard>
  );
}
