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
import styles from "./FamilyHomeClient.module.css";
import feeStyles from "./FamilyFeesClient.module.css";

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

type FamilyFeeData = {
  season: FeeSeasonRecord | null;
  fee: MemberFeeRecord | null;
  due: number;
  remaining: number;
};

type CheckoutSession = {
  clientSecret: string;
  publishableKey: string;
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

  const { data, loading, refreshing, error, reload, loadedClubId } =
    useAsyncClubResource(
    activeClub,
    async (club) => {
      if (!selectedMemberId) {
        return {
          season: null,
          fee: null,
          due: 0,
          remaining: 0,
        } satisfies FamilyFeeData;
      }
      const season = await getActiveSeason(club.id);
      if (!season) {
        return { season: null, fee: null, due: 0, remaining: 0 };
      }
      const fee = await getMemberFee(club.id, season.id, selectedMemberId);
      const due = fee ? amountDueCents(fee, season) : 0;
      const remaining = fee ? remainingCents(fee, season) : 0;
      return { season, fee, due, remaining };
    },
    [selectedMemberId],
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
    if (!activeClub || !selectedMemberId || !data?.season || !data.fee) return;
    setCheckoutBusy(true);
    try {
      const result = await createStripeCheckout({
        clubId: activeClub.id,
        seasonId: data.season.id,
        memberId: selectedMemberId,
        amountCents: data.remaining,
        currency: data.season.currency || "eur",
      });
      if (result.clientSecret && result.publishableKey) {
        FeePaymentAnalytics.trackStarted({
          amountCents: data.remaining,
          currency: data.season.currency || "eur",
          hasSession: Boolean(result.sessionId),
        });
        setCheckoutSession({
          clientSecret: result.clientSecret,
          publishableKey: result.publishableKey,
        });
        return;
      }
      FeePaymentAnalytics.trackStarted({
        amountCents: data.remaining,
        currency: data.season.currency || "eur",
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

  if ((loading || audienceLoading) && !data) {
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
                      de frais)
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
          canPayOnline ? (
            <button
              type="button"
              className={feeStyles.payButton}
              disabled={checkoutBusy}
              onClick={() => void handleCheckout()}
            >
              {checkoutBusy
                ? "Préparation…"
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
          amountCents={data?.remaining}
          currency={data?.season?.currency || "eur"}
          onClose={() => setCheckoutSession(null)}
          onPaid={() => reload()}
        />
      ) : null}
    </div>
  );
}
