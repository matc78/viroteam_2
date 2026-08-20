"use client";

import { FormEvent, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { FEE_PAYMENT_METHOD_OPTIONS } from "@/lib/dashboard/feesConfig";
import {
  loadFeesTrackingData,
  type FeeTrackingRow,
  type FeesTrackingData,
} from "@/lib/dashboard/feesTracking";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import {
  FeeAidStatuses,
  OfflinePaymentMethods,
  type OfflinePaymentMethod,
} from "@/lib/firebase/constants";
import type { ClubRecord } from "@/lib/firebase/clubService";
import {
  remainingCents,
  setFeeAidStatus,
  validateOfflinePayment,
} from "@/lib/firebase/feeService";
import panelStyles from "./DashboardPanel.module.css";
import { PlanningSelect } from "./PlanningSelect";
import styles from "./FeesTrackingPanel.module.css";

/** Props du panneau suivi cotisations. */
type FeesTrackingPanelProps = {
  club: ClubRecord;
};

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

const OFFLINE_LABELS = new Map(
  FEE_PAYMENT_METHOD_OPTIONS.map((option) => [option.id, option.label]),
);

/** Suivi opérationnel : paiements hors-ligne et validation d'aides. */
export function FeesTrackingPanel({ club }: FeesTrackingPanelProps) {
  const { showToast } = useToast();
  const { data, loading, error, reload } = useAsyncClubResource(
    club,
    loadFeesTrackingData,
    [],
  );
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <section className={`${panelStyles.panel} ${styles.section}`} data-tone="blue">
        <p className={styles.lead}>Chargement du suivi…</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className={`${panelStyles.panel} ${styles.section}`} data-tone="blue">
        <h2 className={styles.title}>Suivi des cotisations</h2>
        <p className={styles.lead}>
          Aucune saison active — configurez la saison ci-dessus pour suivre les
          paiements.
        </p>
      </section>
    );
  }

  return (
    <section
      className={`${panelStyles.panel} ${styles.section}`}
      data-tone="blue"
      aria-labelledby="fees-tracking-title"
    >
      <h2 id="fees-tracking-title" className={styles.title}>
        Suivi des cotisations
      </h2>
      <p className={styles.lead}>
        Retards, paiements hors-ligne et validation des aides pour{" "}
        {data.season.seasonLabel}.
      </p>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {data.rows.length === 0 ? (
        <p className={styles.empty} role="status">
          Aucun membre en attente de règlement ou de validation d&apos;aide.
        </p>
      ) : (
        <ul className={styles.list}>
          {data.rows.map((row) => (
            <FeeTrackingRowItem
              key={row.memberId}
              clubId={club.id}
              season={data.season}
              row={row}
              expanded={expandedMemberId === row.memberId}
              busy={busyMemberId === row.memberId}
              onToggle={() =>
                setExpandedMemberId((current) =>
                  current === row.memberId ? null : row.memberId,
                )
              }
              onBusyChange={setBusyMemberId}
              onDone={() => void reload()}
              showToast={showToast}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

type FeeTrackingRowItemProps = {
  clubId: string;
  season: FeesTrackingData["season"];
  row: FeeTrackingRow;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onBusyChange: (memberId: string | null) => void;
  onDone: () => void;
  showToast: (message: string, tone: "success" | "error") => void;
};

function FeeTrackingRowItem({
  clubId,
  season,
  row,
  expanded,
  busy,
  onToggle,
  onBusyChange,
  onDone,
  showToast,
}: FeeTrackingRowItemProps) {
  const remaining = remainingCents(row.fee, season);
  const [offlineMethod, setOfflineMethod] = useState<OfflinePaymentMethod>(
    OfflinePaymentMethods[0],
  );
  const [amountEuros, setAmountEuros] = useState(() =>
    (remaining / 100).toFixed(2),
  );

  const pendingAids = useMemo(
    () =>
      row.fee.aids.filter(
        (aid) => aid.status === FeeAidStatuses.pendingProof,
      ),
    [row.fee.aids],
  );

  async function handleOfflineSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const euros = Number.parseFloat(amountEuros.replace(",", "."));
    if (!Number.isFinite(euros) || euros <= 0) {
      showToast("Montant invalide", "error");
      return;
    }
    onBusyChange(row.memberId);
    try {
      await validateOfflinePayment({
        clubId,
        seasonId: season.id,
        memberId: row.memberId,
        offlineMethod,
        amountCents: Math.round(euros * 100),
        season,
      });
      showToast("Paiement hors-ligne enregistré", "success");
      onDone();
    } catch (submitError) {
      showToast(
        submitError instanceof Error
          ? submitError.message
          : "Échec de l'enregistrement",
        "error",
      );
    } finally {
      onBusyChange(null);
    }
  }

  async function handleAidStatus(
    aidId: string,
    aidStatus:
      | typeof FeeAidStatuses.validated
      | typeof FeeAidStatuses.rejected,
  ) {
    if (busy) return;
    onBusyChange(row.memberId);
    try {
      await setFeeAidStatus({
        clubId,
        seasonId: season.id,
        memberId: row.memberId,
        aidId,
        aidStatus,
        season,
      });
      showToast(
        aidStatus === FeeAidStatuses.validated ? "Aide validée" : "Aide refusée",
        "success",
      );
      onDone();
    } catch (aidError) {
      showToast(
        aidError instanceof Error ? aidError.message : "Échec de la validation",
        "error",
      );
    } finally {
      onBusyChange(null);
    }
  }

  return (
    <li className={styles.row}>
      <button
        type="button"
        className={styles.rowHeader}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className={styles.rowName}>{row.displayName}</span>
        <span className={styles.rowMeta}>
          <span className={styles.badge}>{row.feeStatusLabel}</span>
          {row.hasPendingAids ? (
            <span className={`${styles.badge} ${styles.badgeWarning}`}>
              Aide à valider
            </span>
          ) : null}
          <span className={styles.remaining}>
            Reste {formatEuros(remaining)}
          </span>
        </span>
      </button>

      {expanded ? (
        <div className={styles.rowBody}>
          {pendingAids.length > 0 ? (
            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Aides en attente</h3>
              <ul className={styles.aidList}>
                {pendingAids.map((aid) => (
                  <li key={aid.id} className={styles.aidRow}>
                    <span>
                      {aid.label || aid.type} — {formatEuros(aid.amountCents)}
                    </span>
                    <span className={styles.aidActions}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={busy}
                        onClick={() =>
                          void handleAidStatus(aid.id, FeeAidStatuses.validated)
                        }
                      >
                        Valider
                      </button>
                      <button
                        type="button"
                        className={styles.ghostButton}
                        disabled={busy}
                        onClick={() =>
                          void handleAidStatus(aid.id, FeeAidStatuses.rejected)
                        }
                      >
                        Refuser
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form className={styles.block} onSubmit={(e) => void handleOfflineSubmit(e)}>
            <h3 className={styles.blockTitle}>Paiement hors-ligne</h3>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Moyen</span>
                <PlanningSelect
                  id="fees-offline-method"
                  value={offlineMethod}
                  options={OfflinePaymentMethods.map((method) => ({
                    value: method,
                    label: OFFLINE_LABELS.get(method) ?? method,
                  }))}
                  onChange={(next) =>
                    setOfflineMethod(next as OfflinePaymentMethod)
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Montant (€)</span>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step={0.01}
                  value={amountEuros}
                  onChange={(event) => setAmountEuros(event.target.value)}
                />
              </label>
            </div>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={busy}
            >
              {busy ? "Enregistrement…" : "Valider le paiement"}
            </button>
          </form>
        </div>
      ) : null}
    </li>
  );
}
