"use client";

import { useReportPageReady } from "@/components/common/PageLoadProvider";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { FamilyAudienceSwitcher } from "@/components/family/FamilyAudienceSwitcher";
import { useFamilyAudience } from "@/components/family/FamilyAudienceProvider";
import { StripeFeeCheckout } from "@/components/fees/StripeFeeCheckout";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import panelStyles from "@/components/dashboard/DashboardPanel.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import { useToast } from "@/components/ToastProvider";
import { STRIPE_PAYMENTS_LIVE } from "@/lib/featureFlags";
import {
  CARD_FEE_NOTICE,
  cardFeeCentsFromNet,
  cardGrossCentsFromNet,
} from "@/lib/stripe/cardGrossFromNet";
import {
  isClubResourceReady,
  useAsyncClubResource,
} from "@/lib/dashboard/useAsyncClubResource";
import {
  ClubListenSets,
  useClubRealtimeReload,
  useIsPortalRouteActive,
} from "@/lib/dashboard/useClubRealtimeReload";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { createStripeCheckout } from "@/lib/firebase/callableService";
import {
  FeePaymentAnalytics,
  feePaymentErrorCode,
} from "@/lib/fees/feePaymentAnalytics";
import * as Sentry from "@sentry/nextjs";
import {
  amountDueCents,
  getActiveSeason,
  getMemberFee,
  remainingCents,
  type FeeSeasonRecord,
  type MemberFeeRecord,
} from "@/lib/firebase/feeService";
import { FeePaymentHistory } from "@/components/fees/FeePaymentHistory";
import { feeStatusLabel } from "@/lib/members/membersView";
import { useState } from "react";
import { feesCopy } from "@/lib/copy/feesCopy";
import { isLoadedForScope, type FamilyScope } from "@/lib/family/familyScope";
import type { FeePaymentKey } from "@/lib/fees/pendingFeePayment";
import { usePendingFeePayment } from "@/lib/fees/usePendingFeePayment";
import styles from "./FamilyHomeClient.module.css";
import feeStyles from "./FamilyFeesClient.module.css";

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

type FamilyFeeData = FamilyScope & {
  season: FeeSeasonRecord | null;
  fee: MemberFeeRecord | null;
  due: number;
  remaining: number;
};

type CheckoutSession = {
  clientSecret: string;
  publishableKey: string;
  /** Cotisation et reste dû au lancement (suivi « en validation »). */
  key: FeePaymentKey;
  remainingCents: number;
  currency: string;
};

/** Vue payeur : statut, reste dû, consignes, checkout Stripe si flag live. */
export function FamilyFeesClient() {
  const { activeClub } = useAuth();
  const { selectedMemberId, selectedTarget, loading: audienceLoading } =
    useFamilyAudience();
  const { showToast } = useToast();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutSession, setCheckoutSession] = useState<CheckoutSession | null>(
    null,
  );

  const {
    data: loadedData,
    loading,
    refreshing,
    error,
    reload,
    loadedClubId,
  } = useAsyncClubResource<FamilyFeeData>(
    activeClub,
    async (club) => {
      const memberId = selectedMemberId;
      const scope = { clubId: club.id, memberId };
      if (!memberId) {
        return { ...scope, season: null, fee: null, due: 0, remaining: 0 };
      }
      const season = await getActiveSeason(club.id);
      if (!season) {
        return { ...scope, season: null, fee: null, due: 0, remaining: 0 };
      }
      const fee = await getMemberFee(club.id, season.id, memberId);
      const due = fee ? amountDueCents(fee, season) : 0;
      const remaining = fee ? remainingCents(fee, season) : 0;
      return { ...scope, season, fee, due, remaining };
    },
    [selectedMemberId],
  );
  // Données d’un autre enfant / club (rechargement en cours) : jamais
  // affichées ni utilisées pour payer.
  const data = isLoadedForScope(loadedData, {
    clubId: activeClub?.id ?? null,
    memberId: selectedMemberId,
  })
    ? loadedData
    : null;
  const feeKey: FeePaymentKey | null =
    data?.clubId && data.memberId && data.season && data.fee
      ? {
          clubId: data.clubId,
          seasonId: data.season.id,
          memberId: data.memberId,
        }
      : null;
  const { pending: paymentPending, markSubmitted } = usePendingFeePayment(
    feeKey,
    data?.remaining ?? 0,
  );
  const familyFeesActive = useIsPortalRouteActive(["/family/fees"]);
  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.familyFees,
    listenActiveMemberFees: true,
    memberFeeIds: selectedMemberId ? [selectedMemberId] : [],
    onReload: reload,
    enabled: familyFeesActive,
  });

  useReportPageReady(
    !audienceLoading &&
      isClubResourceReady(activeClub, { loading, loadedClubId }),
    "/family/fees",
  );

  async function handleCheckout() {
    // Clé figée : la cotisation affichée (club, saison, enfant) au clic.
    if (!feeKey || !data?.season || refreshing || paymentPending) return;
    const amountCents = data.remaining;
    const currency = data.season.currency || "eur";
    setCheckoutBusy(true);
    try {
      const result = await createStripeCheckout({
        clubId: feeKey.clubId,
        seasonId: feeKey.seasonId,
        memberId: feeKey.memberId,
        amountCents,
        currency,
      });
      if (result.clientSecret && result.publishableKey) {
        FeePaymentAnalytics.trackStarted({
          amountCents,
          currency,
          hasSession: Boolean(result.sessionId),
        });
        setCheckoutSession({
          clientSecret: result.clientSecret,
          publishableKey: result.publishableKey,
          key: feeKey,
          remainingCents: amountCents,
          currency,
        });
        return;
      }
      FeePaymentAnalytics.trackStarted({
        amountCents,
        currency,
        hasSession: Boolean(result.sessionId),
      });
      showToast(result.message ?? "Paiement enregistré.");
      reload();
    } catch (err: unknown) {
      FeePaymentAnalytics.trackFailed({
        stage: "callable",
        errorCode: feePaymentErrorCode(err),
      });
      Sentry.captureException(err, {
        tags: { feature: "fees", area: "create_checkout" },
        extra: { stage: "callable" },
      });
      showToast(
        err instanceof Error ? err.message : "Impossible de lancer le paiement.",
      );
    } finally {
      setCheckoutBusy(false);
    }
  }

  if ((loading || audienceLoading || loadedData) && !data && !error) {
    return <DashboardSkeleton variant="fees" />;
  }

  const whose =
    selectedTarget?.kind === "self"
      ? "toi"
      : selectedTarget?.label || "l’enfant";

  const canPayOnline =
    STRIPE_PAYMENTS_LIVE &&
    Boolean(activeClub?.onlinePaymentEnabled) &&
    data?.fee &&
    data.remaining > 0;

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace famille"
        heading="Cotisation"
        lead={`Statut et paiement pour ${whose}.`}
        onRefresh={reload}
        refreshing={refreshing}
      />
      <FamilyAudienceSwitcher />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      <section className={panelStyles.panel} data-tone="orange">
        {!data?.season || !data.fee ? (
          <p className={styles.empty}>
            Pas de fiche cotisation pour cette saison.
          </p>
        ) : (
          <dl className={feeStyles.details}>
            <div>
              <dt>Saison</dt>
              <dd>{data.season.seasonLabel}</dd>
            </div>
            <div>
              <dt>Statut</dt>
              <dd>{feeStatusLabel(data.fee.status)}</dd>
            </div>
            <div>
              <dt>Montant</dt>
              <dd>{formatEuros(data.due)}</dd>
            </div>
            <div>
              <dt>Reste dû</dt>
              <dd>{formatEuros(data.remaining)}</dd>
            </div>
            {canPayOnline ? (
              <div className={feeStyles.full}>
                <dt>Paiement CB</dt>
                <dd>
                  {formatEuros(cardGrossCentsFromNet(data.remaining))}
                  {cardFeeCentsFromNet(data.remaining) > 0 ? (
                    <span className={styles.empty}>
                      {" "}
                      (dont {formatEuros(cardFeeCentsFromNet(data.remaining))}{" "}
                      de frais — {CARD_FEE_NOTICE})
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {data.season.paymentInstructions ? (
              <div className={feeStyles.full}>
                <dt>Consignes</dt>
                <dd className={feeStyles.prewrap}>
                  {data.season.paymentInstructions}
                </dd>
              </div>
            ) : null}
            {data.season.iban ? (
              <div className={feeStyles.full}>
                <dt>IBAN</dt>
                <dd className={feeStyles.iban}>{data.season.iban}</dd>
              </div>
            ) : null}
          </dl>
        )}

        {activeClub && data?.season && data.fee && selectedMemberId ? (
          <FeePaymentHistory
            clubId={activeClub.id}
            seasonId={data.season.id}
            memberId={selectedMemberId}
            compact
          />
        ) : null}

        {data?.fee && data.remaining > 0 ? (
          paymentPending ? (
            <p className={styles.empty} role="status">
              <strong>{feesCopy.paymentPendingTitle}</strong>
              {" — "}
              {feesCopy.paymentPendingText}
            </p>
          ) : canPayOnline ? (
            <button
              type="button"
              className={feeStyles.payButton}
              disabled={checkoutBusy || refreshing}
              onClick={() => void handleCheckout()}
            >
              {checkoutBusy
                ? "Préparation…"
                : refreshing
                  ? feesCopy.payButtonRefreshing
                  : `Payer ${formatEuros(cardGrossCentsFromNet(data.remaining))}`}
            </button>
          ) : (
            <p className={styles.empty}>
              {STRIPE_PAYMENTS_LIVE
                ? "Le paiement CB n’est pas encore activé pour ce club. Utilise les consignes et l’IBAN ci-dessus."
                : "Le paiement en ligne arrive bientôt. En attendant, utilise les consignes et l’IBAN ci-dessus."}
            </p>
          )
        ) : null}
      </section>

      {checkoutSession ? (
        <StripeFeeCheckout
          clientSecret={checkoutSession.clientSecret}
          publishableKey={checkoutSession.publishableKey}
          amountCents={checkoutSession.remainingCents}
          currency={checkoutSession.currency}
          onClose={() => setCheckoutSession(null)}
          onPaid={() => {
            markSubmitted(
              checkoutSession.key,
              checkoutSession.remainingCents,
            );
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
