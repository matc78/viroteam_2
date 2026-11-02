import { useMemo } from "react";
import { CollectionsChart } from "@/components/dashboard/CollectionsChart";
import { StatGrid, StatTile } from "@/components/ui/StatTile";
import type { FeeTrackingRow } from "@/lib/dashboard/feesTracking";
import { MemberFeeStatuses } from "@/lib/firebase/constants";
import { buildCollections } from "@/lib/firebase/homeService";
import type { MemberFeeRecord } from "@/lib/firebase/feeService";
import styles from "./FeesOverview.module.css";

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * En-tête du suivi cotisations : encaissé, reste dû, fiches soldées, actions
 * en attente, puis l’histogramme des encaissements des 6 derniers mois.
 */
export function FeesOverview({
  rows,
  showCardPayments,
}: {
  rows: FeeTrackingRow[];
  /** Paiement en ligne activé : affiche la série CB du graphique. */
  showCardPayments: boolean;
}) {
  const summary = useMemo(() => {
    let collected = 0;
    let remaining = 0;
    let billed = 0;
    let settled = 0;
    let needsAction = 0;
    const fees: MemberFeeRecord[] = [];
    for (const row of rows) {
      if (row.fee) fees.push(row.fee);
      if (row.needsAction) needsAction += 1;
      if (!row.fee || row.status === MemberFeeStatuses.exonere) continue;
      billed += 1;
      collected += row.amountPaidCents;
      remaining += row.remainingCents;
      if (row.status === MemberFeeStatuses.paye) settled += 1;
    }
    return {
      collected,
      remaining,
      billed,
      settled,
      needsAction,
      months: buildCollections(fees),
    };
  }, [rows]);

  return (
    <div className={styles.root}>
      <StatGrid>
        <StatTile
          label="Encaissé"
          value={formatEuros(summary.collected)}
          hint="Saison en cours"
        />
        <StatTile
          label="Reste dû"
          value={formatEuros(summary.remaining)}
          hint="À encaisser"
          tone={summary.remaining > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Fiches soldées"
          value={`${summary.settled} / ${summary.billed}`}
          hint="Hors exonérés"
        />
        <StatTile
          label="À traiter"
          value={summary.needsAction}
          hint="Paiements ou aides en attente"
          tone={summary.needsAction > 0 ? "warning" : "neutral"}
        />
      </StatGrid>
      <CollectionsChart
        months={summary.months}
        showHelloAsso={showCardPayments}
      />
    </div>
  );
}
