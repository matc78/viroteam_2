"use client";

import { useState } from "react";
import { useAsyncClubPageResource } from "@/components/common/useAsyncClubPageResource";
import { useReportPageReady } from "@/components/common/PageLoadProvider";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { FeesConfigForm } from "@/components/dashboard/FeesConfigForm";
import { FeesTrackingPanel } from "@/components/dashboard/FeesTrackingPanel";
import {
  emptyFeesConfig,
  FeesConfig,
  seasonRecordToFeesConfig,
} from "@/lib/dashboard/feesConfig";
import {
  ClubListenSets,
  useClubRealtimeReload,
  useIsPortalRouteActive,
} from "@/lib/dashboard/useClubRealtimeReload";
import { STRIPE_PAYMENTS_LIVE } from "@/lib/featureFlags";
import {
  cardFeeCentsFromNet,
  cardGrossCentsFromNet,
} from "@/lib/stripe/cardGrossFromNet";
import type { ClubRecord } from "@/lib/firebase/clubService";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { createStripeCheckout } from "@/lib/firebase/callableService";
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
import { StripeFeeCheckout } from "@/components/fees/StripeFeeCheckout";
import { useToast } from "@/components/ToastProvider";
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
      stripeConnectedAccountId: club.stripeConnectedAccountId,
      stripeConnectStatus: club.stripeConnectStatus,
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
  const { showToast } = useToast();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutSession, setCheckoutSession] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);
  const { data, loading, refreshing, error, reload } = useAsyncClubPageResource(
    activeClub && user ? activeClub : null,
    (club) => loadPlayerSelfFee(club, user!.uid),
    [user?.uid],
    "/fees",
  );
  const feesActive = useIsPortalRouteActive(["/fees"]);
  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.fees,
    listenActiveMemberFees: true,
    memberFeeIds: data?.linkedMemberId ? [data.linkedMemberId] : [],
    onReload: reload,
    enabled: feesActive,
  });

  async function handleCheckout() {
    if (!activeClub || !data?.season || !data.fee || !data.linkedMemberId) {
      return;
    }
    setCheckoutBusy(true);
    try {
      const result = await createStripeCheckout({
        clubId: activeClub.id,
        seasonId: data.season.id,
        memberId: data.linkedMemberId,
        amountCents: data.remaining,
        currency: data.season.currency || "eur",
      });
      if (result.clientSecret && result.publishableKey) {
        setCheckoutSession({
          clientSecret: result.clientSecret,
          publishableKey: result.publishableKey,
        });
        return;
      }
      showToast(result.message ?? "Paiement enregistré.");
      reload();
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Impossible de lancer le paiement.",
      );
    } finally {
      setCheckoutBusy(false);
    }
  }

  if (loading && !data) {
    return <DashboardSkeleton variant="fees" />;
  }

  const emptyMessage = data ? playerFeeEmptyMessage(data) : "";
  const showDetails =
    data?.season &&
    data.fee &&
    data.fee.status !== MemberFeeStatuses.paye &&
    data.fee.status !== MemberFeeStatuses.exonere;
  const canPayOnline =
    STRIPE_PAYMENTS_LIVE &&
    Boolean(activeClub?.onlinePaymentEnabled) &&
    showDetails &&
    data!.remaining > 0;

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
            {canPayOnline ? (
              <div className={feeStyles.full}>
                <dt>Paiement CB</dt>
                <dd>
                  {formatEuros(cardGrossCentsFromNet(data!.remaining))}
                  {cardFeeCentsFromNet(data!.remaining) > 0 ? (
                    <span className={familyStyles.empty}>
                      {" "}
                      (dont{" "}
                      {formatEuros(cardFeeCentsFromNet(data!.remaining))} de
                      frais)
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}
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

        {canPayOnline ? (
          <button
            type="button"
            className={feeStyles.payButton}
            disabled={checkoutBusy}
            onClick={() => void handleCheckout()}
          >
            {checkoutBusy
              ? "Préparation…"
              : `Payer ${formatEuros(cardGrossCentsFromNet(data!.remaining))}`}
          </button>
        ) : null}

        {showDetails && !canPayOnline && data!.remaining > 0 ? (
          <p className={familyStyles.empty}>
            {STRIPE_PAYMENTS_LIVE
              ? "Le paiement CB n’est pas encore activé pour ce club. Suis les consignes ci-dessus."
              : "Le paiement en ligne arrive bientôt. En attendant, suis les consignes ci-dessus."}
          </p>
        ) : null}
      </section>

      {checkoutSession ? (
        <StripeFeeCheckout
          clientSecret={checkoutSession.clientSecret}
          publishableKey={checkoutSession.publishableKey}
          onClose={() => setCheckoutSession(null)}
          onPaid={() => reload()}
        />
      ) : null}
    </div>
  );
}

/** Accès refusé cotisations (ni admin ni coach lecture). */
function FeesNoAccessView() {
  useReportPageReady(true, "/fees");
  return (
    <div>
      <DashboardPageIntro
        eyebrow="Espace club"
        heading="Cotisations"
        lead="Accès réservé aux administrateurs."
      />
    </div>
  );
}

/** Vue admin / coach lecture : config + suivi. */
function FeesStaffView() {
  const { activeClub, activeClubRole, user, refreshProfile } = useAuth();
  const isAdmin = activeClubRole === MemberRoles.admin;
  const isCoachRead =
    activeClubRole === MemberRoles.coach &&
    Boolean(activeClub?.coachPermissions.canViewFees);

  const { data: config, loading, refreshing, error, reload } =
    useAsyncClubPageResource(
      activeClub,
      loadFeesConfigForClub,
      [isAdmin, isCoachRead],
      "/fees",
    );
  const feesActive = useIsPortalRouteActive(["/fees"]);
  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.fees,
    listenActiveMemberFees: true,
    onReload: reload,
    enabled: feesActive,
  });
  const [tab, setTab] = useState<FeesTab>("config");

  if (loading && !config) {
    return <DashboardSkeleton variant="fees" />;
  }

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace club"
        heading="Cotisations"
        lead={
          isCoachRead && !isAdmin
            ? `Suivi en lecture des cotisations de ${activeClub?.name ?? "votre club"}.`
            : `Configurez la saison et suivez les paiements de ${activeClub?.name ?? "votre club"}.`
        }
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
          {isAdmin ? (
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
          ) : null}

          {isAdmin && tab === "config" ? (
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
              {isCoachRead && !isAdmin ? (
                <p className={introStyles.lead}>
                  Lecture seule — les actions d’encaissement restent réservées
                  aux administrateurs.
                </p>
              ) : null}
              <FeesTrackingPanel
                key={activeClub.id}
                club={activeClub}
                readOnly={isCoachRead && !isAdmin}
              />
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

/**
 * Contenu page Cotisations : routeur par rôle (un seul `markPageReady` actif).
 */
export function FeesPageClient() {
  const { activeClub, activeClubRole } = useAuth();
  const isPlayer = activeClubRole === MemberRoles.player;
  const isAdmin = activeClubRole === MemberRoles.admin;
  const isCoachRead =
    activeClubRole === MemberRoles.coach &&
    Boolean(activeClub?.coachPermissions.canViewFees);

  if (isPlayer || (activeClubRole === MemberRoles.coach && !isCoachRead)) {
    return <PlayerFeesSelfView />;
  }

  if (!isAdmin && !isCoachRead) {
    return <FeesNoAccessView />;
  }

  return <FeesStaffView />;
}
