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
import { MemberFeeStatuses, MemberRoles } from "@/lib/firebase/constants";
import {
  amountDueCents,
  getActiveSeason,
  getMemberFee,
  remainingCents,
  type FeeSeasonRecord,
  type MemberFeeRecord,
} from "@/lib/firebase/feeService";
import { getLinkedMemberId } from "@/lib/firebase/memberService";
import { feeStatusLabel } from "@/lib/members/membersView";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import panelStyles from "@/components/dashboard/DashboardPanel.module.css";
import tabStyles from "@/components/dashboard/MembersTabs.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import feeStyles from "@/components/family/FamilyFeesClient.module.css";
import familyStyles from "@/components/family/FamilyHomeClient.module.css";

type FeesTab = "config" | "tracking";

type PlayerFeeData = {
  season: FeeSeasonRecord | null;
  fee: MemberFeeRecord | null;
  due: number;
  remaining: number;
  linkedMemberId: string | null;
};

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

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

/** Charge la cotisation du joueur connecté. */
async function loadPlayerSelfFee(
  club: ClubRecord,
  uid: string,
): Promise<PlayerFeeData> {
  const linkedMemberId = await getLinkedMemberId(club.id, uid);
  const season = await getActiveSeason(club.id);
  if (!season || !linkedMemberId) {
    return {
      season,
      fee: null,
      due: 0,
      remaining: 0,
      linkedMemberId,
    };
  }
  const fee = await getMemberFee(club.id, season.id, linkedMemberId);
  const due = fee ? amountDueCents(fee, season) : 0;
  const remaining = fee ? remainingCents(fee, season) : 0;
  return { season, fee, due, remaining, linkedMemberId };
}

/** Message empty-state pour le joueur selon le statut. */
function playerFeeEmptyMessage(data: PlayerFeeData): string {
  if (!data.linkedMemberId) {
    return "Aucune fiche membre liée à ton compte.";
  }
  if (!data.season) {
    return "Rien à faire pour le moment — aucune saison de cotisation active.";
  }
  if (!data.fee) {
    return "Rien à faire pour le moment — aucune cotisation à régler.";
  }
  if (
    data.fee.status === MemberFeeStatuses.paye ||
    data.fee.status === MemberFeeStatuses.exonere
  ) {
    return data.fee.status === MemberFeeStatuses.paye
      ? "Déjà payé — ta cotisation est à jour."
      : "Rien à faire — tu es exonéré pour cette saison.";
  }
  return "";
}

/** Vue cotisation self pour le rôle joueur. */
function PlayerFeesSelfView() {
  const { activeClub, user } = useAuth();
  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub && user ? activeClub : null,
    (club) => loadPlayerSelfFee(club, user!.uid),
    [user?.uid],
  );

  if (loading && !data) {
    return <DashboardSkeleton variant="fees" />;
  }

  const emptyMessage = data ? playerFeeEmptyMessage(data) : "";
  const showDetails =
    data?.season &&
    data.fee &&
    data.fee.status !== MemberFeeStatuses.paye &&
    data.fee.status !== MemberFeeStatuses.exonere;

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Mon club"
        heading="Ma cotisation"
        lead={`Statut pour ${activeClub?.name ?? "ton club"}.`}
        onRefresh={reload}
        refreshing={refreshing}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      <section className={panelStyles.panel} data-tone="orange">
        {!showDetails ? (
          <p className={familyStyles.empty}>{emptyMessage || "Rien à faire."}</p>
        ) : (
          <dl className={feeStyles.details}>
            <div>
              <dt>Saison</dt>
              <dd>{data!.season!.seasonLabel}</dd>
            </div>
            <div>
              <dt>Statut</dt>
              <dd>{feeStatusLabel(data!.fee!.status)}</dd>
            </div>
            <div>
              <dt>Montant</dt>
              <dd>{formatEuros(data!.due)}</dd>
            </div>
            <div>
              <dt>Reste dû</dt>
              <dd>{formatEuros(data!.remaining)}</dd>
            </div>
            {data!.season!.paymentInstructions ? (
              <div className={feeStyles.full}>
                <dt>Consignes</dt>
                <dd className={feeStyles.prewrap}>
                  {data!.season!.paymentInstructions}
                </dd>
              </div>
            ) : null}
            {data!.season!.iban ? (
              <div className={feeStyles.full}>
                <dt>IBAN</dt>
                <dd className={feeStyles.iban}>{data!.season!.iban}</dd>
              </div>
            ) : null}
          </dl>
        )}

        {showDetails &&
        data!.fee!.status === MemberFeeStatuses.paye ? (
          <p className={familyStyles.empty}>Déjà payé.</p>
        ) : null}
      </section>
    </div>
  );
}

/** Contenu page Cotisations branché sur Firestore (admin ou joueur). */
export function FeesPageClient() {
  const { activeClub, activeClubRole, user, refreshProfile } = useAuth();
  const isPlayer = activeClubRole === MemberRoles.player;

  const { data: config, loading, refreshing, error, reload } =
    useAsyncClubResource(
      !isPlayer ? activeClub : null,
      loadFeesConfigForClub,
      [isPlayer],
    );
  const [tab, setTab] = useState<FeesTab>("config");

  if (isPlayer) {
    return <PlayerFeesSelfView />;
  }

  if (loading && !config) {
    return <DashboardSkeleton variant="fees" />;
  }

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace club"
        heading="Cotisations"
        lead={`Configurez la saison et suivez les paiements de ${activeClub?.name ?? "votre club"}.`}
        onRefresh={reload}
        refreshing={refreshing}
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
