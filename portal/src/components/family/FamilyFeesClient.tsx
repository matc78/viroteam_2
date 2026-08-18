"use client";

import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { FamilyAudienceSwitcher } from "@/components/family/FamilyAudienceSwitcher";
import { useFamilyAudience } from "@/components/family/FamilyAudienceProvider";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import panelStyles from "@/components/dashboard/DashboardPanel.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import { useToast } from "@/components/ToastProvider";
import { HELLOASSO_PAYMENTS_LIVE } from "@/lib/featureFlags";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { createHelloAssoCheckout } from "@/lib/firebase/callableService";
import {
  amountDueCents,
  getActiveSeason,
  getMemberFee,
  remainingCents,
  type FeeSeasonRecord,
  type MemberFeeRecord,
} from "@/lib/firebase/feeService";
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

/** Vue payeur : statut, reste dû, consignes, checkout si flag live. */
export function FamilyFeesClient() {
  const { activeClub } = useAuth();
  const { selectedMemberId, selectedTarget, loading: audienceLoading } =
    useFamilyAudience();
  const { showToast } = useToast();
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const { data, loading, refreshing, error } = useAsyncClubResource(
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

  async function handleCheckout() {
    if (!activeClub || !selectedMemberId || !data?.season || !data.fee) return;
    setCheckoutBusy(true);
    try {
      const origin = window.location.origin;
      const result = await createHelloAssoCheckout({
        clubId: activeClub.id,
        seasonId: data.season.id,
        memberId: selectedMemberId,
        amountCents: data.remaining,
        returnUrl: `${origin}/family/fees`,
        backUrl: `${origin}/family/fees`,
        errorUrl: `${origin}/family/fees`,
      });
      const redirect = result.redirectUrl ?? result.checkoutUrl;
      if (redirect) {
        window.location.assign(redirect);
        return;
      }
      showToast("Paiement enregistré.");
    } catch (err: unknown) {
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

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace famille"
        heading="Cotisation"
        lead={`Statut et paiement pour ${whose}.`}
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

        {data?.fee && data.remaining > 0 ? (
          HELLOASSO_PAYMENTS_LIVE ? (
            <button
              type="button"
              className={feeStyles.payButton}
              disabled={checkoutBusy}
              onClick={() => void handleCheckout()}
            >
              {checkoutBusy ? "Ouverture…" : "Payer en ligne"}
            </button>
          ) : (
            <p className={styles.empty}>
              Le paiement en ligne via HelloAsso arrive bientôt. En attendant,
              utilise les consignes et l’IBAN ci-dessus.
            </p>
          )
        ) : null}
      </section>
    </div>
  );
}
