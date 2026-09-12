"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import type { FeeTrackingRow } from "@/lib/dashboard/feesTracking";
import { MemberFeeStatuses } from "@/lib/firebase/constants";
import type { FeeTier } from "@/lib/firebase/feeService";
import { PlanningSelect } from "./PlanningSelect";
import { FeePaymentHistory } from "@/components/fees/FeePaymentHistory";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import styles from "./CorrectMemberFeeDialog.module.css";

type CorrectStep =
  | "menu"
  | "changeTier"
  | "adjustPaid"
  | "confirmMarkPaid"
  | "confirmExonerate";

type CorrectMemberFeeDialogProps = {
  clubId: string;
  seasonId: string;
  row: FeeTrackingRow;
  tiers: FeeTier[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onChangeTier: (tierId: string) => Promise<void>;
  onAdjustPaid: (values: {
    amountPaidCents: number;
    note: string | null;
  }) => Promise<void>;
  onMarkPaid: () => Promise<void>;
  onExonerate: () => Promise<void>;
};

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function eurosInputFromCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function parseEurosToCents(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const euros = Number(normalized);
  if (!Number.isFinite(euros) || euros < 0) return null;
  return Math.round(euros * 100);
}

function tierOptionLabel(tier: FeeTier): string {
  return `${tier.label} — ${formatEuros(tier.amountCents)}`;
}

/**
 * Hub de correction cotisation : tarif, montant encaissé, reste dû, exonération.
 */
export function CorrectMemberFeeDialog({
  clubId,
  seasonId,
  row,
  tiers,
  busy,
  error,
  onClose,
  onChangeTier,
  onAdjustPaid,
  onMarkPaid,
  onExonerate,
}: CorrectMemberFeeDialogProps) {
  const titleId = useId();
  const amountId = useId();
  const noteId = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<CorrectStep>("menu");
  const [selectedTierId, setSelectedTierId] = useState(row.tierId ?? "");
  const [amountInput, setAmountInput] = useState(
    eurosInputFromCents(row.amountPaidCents),
  );
  const [note, setNote] = useState("");

  const hasTier = Boolean(row.tierId);
  const isExonere = row.status === MemberFeeStatuses.exonere;
  const canMarkPaid = hasTier && !isExonere && row.remainingCents > 0;
  const canAdjustPaid = hasTier && !isExonere;

  useEffect(() => {
    if (step === "adjustPaid") {
      amountRef.current?.focus();
      amountRef.current?.select();
    }
  }, [step]);

  async function handleAdjustSubmit(event: FormEvent) {
    event.preventDefault();
    const amountPaidCents = parseEurosToCents(amountInput);
    if (amountPaidCents == null) return;
    await onAdjustPaid({
      amountPaidCents,
      note: note.trim() || null,
    });
  }

  async function handleChangeTier() {
    if (!selectedTierId) return;
    if (!isExonere && selectedTierId === row.tierId) return;
    await onChangeTier(selectedTierId);
  }

  const amountPaidCents = parseEurosToCents(amountInput);
  const currentTierLabel =
    tiers.find((tier) => tier.tierId === row.tierId)?.label ?? "Non assignée";

  return (
    <div
      className={dialogStyles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={`${panelStyles.panel} ${dialogStyles.panel} ${styles.panel}`}
        data-tone="amber"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>Cotisations</p>
            <h2 id={titleId} className={dialogStyles.title}>
              {step === "menu"
                ? "Corriger la cotisation"
                : step === "changeTier"
                  ? isExonere
                    ? "Désexonérer"
                    : hasTier
                      ? "Changer le tarif"
                      : "Assigner un tarif"
                  : step === "adjustPaid"
                    ? "Rectifier le montant payé"
                    : step === "confirmMarkPaid"
                      ? "Enregistrer le reste dû"
                      : "Exonérer"}
            </h2>
          </div>
          <button
            type="button"
            className={dialogStyles.closeButton}
            disabled={busy}
            aria-label="Fermer"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <p className={styles.memberName}>{row.displayName}</p>
        <p className={styles.summary}>
          {isExonere
            ? "Statut : exonéré — plus de cotisation due."
            : `Tarif : ${currentTierLabel}${
                hasTier
                  ? ` · Dû ${formatEuros(row.amountDueCents)} · Payé ${formatEuros(row.amountPaidCents)} · Reste ${formatEuros(row.remainingCents)}`
                  : ""
              }${row.paymentMethodLabel ? ` · ${row.paymentMethodLabel}` : ""}`}
        </p>

        {step === "menu" ? (
          <div className={styles.options}>
            {isExonere ? (
              <button
                type="button"
                className={styles.option}
                disabled={busy || tiers.length === 0}
                onClick={() => {
                  setSelectedTierId("");
                  setStep("changeTier");
                }}
              >
                <span className={styles.optionTitle}>Désexonérer</span>
                <span className={styles.optionHint}>
                  Remettre une cotisation due : choisis un tarif pour ce membre.
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.option}
                  disabled={busy || tiers.length === 0}
                  onClick={() => {
                    setSelectedTierId(row.tierId ?? "");
                    setStep("changeTier");
                  }}
                >
                  <span className={styles.optionTitle}>
                    {hasTier ? "Changer le tarif" : "Assigner un tarif"}
                  </span>
                  <span className={styles.optionHint}>
                    {hasTier
                      ? "Mauvais palier (U15 au lieu de Senior, etc.) — le déjà payé est conservé."
                      : "Choisir le montant catalogue pour ce membre."}
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.option}
                  disabled={busy || !canAdjustPaid}
                  onClick={() => {
                    setAmountInput(eurosInputFromCents(row.amountPaidCents));
                    setNote("");
                    setStep("adjustPaid");
                  }}
                >
                  <span className={styles.optionTitle}>
                    Rectifier le montant déjà encaissé
                  </span>
                  <span className={styles.optionHint}>
                    Erreur de saisie ou trop-perçu — pose le total payé (pas un
                    nouveau paiement).
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.option}
                  disabled={busy || !canMarkPaid}
                  onClick={() => setStep("confirmMarkPaid")}
                >
                  <span className={styles.optionTitle}>
                    Enregistrer le reste dû
                    {canMarkPaid
                      ? ` (${formatEuros(row.remainingCents)})`
                      : ""}
                  </span>
                  <span className={styles.optionHint}>
                    Nouveau paiement hors-ligne (espèces) pour solder le reste.
                  </span>
                </button>

                <button
                  type="button"
                  className={`${styles.option} ${styles.optionDanger}`}
                  disabled={busy}
                  onClick={() => setStep("confirmExonerate")}
                >
                  <span className={styles.optionTitle}>Exonérer</span>
                  <span className={styles.optionHint}>
                    Plus de cotisation due pour ce membre (staff, cas spécial…).
                  </span>
                </button>
              </>
            )}

            <FeePaymentHistory
              clubId={clubId}
              seasonId={seasonId}
              memberId={row.memberId}
              compact
            />
          </div>
        ) : null}

        {step === "changeTier" ? (
          <div className={styles.stepBody}>
            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>Nouveau tarif</span>
              <PlanningSelect
                id={`correct-tier-${row.memberId}`}
                value={selectedTierId}
                placeholder="Choisir un tarif…"
                aria-label="Choisir un tarif"
                disabled={busy}
                options={tiers.map((tier) => ({
                  value: tier.tierId,
                  label: tierOptionLabel(tier),
                }))}
                onChange={setSelectedTierId}
              />
            </label>
            <p className={styles.hint}>
              {isExonere
                ? "Le membre redevient redevable de cotisation avec ce tarif."
                : "Le montant déjà encaissé est conservé ; le statut (payé / partiel / à payer) est recalculé."}
            </p>
            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={dialogStyles.buttonSecondary}
                disabled={busy}
                onClick={() => setStep("menu")}
              >
                Retour
              </button>
              <button
                type="button"
                className={dialogStyles.button}
                disabled={
                  busy ||
                  !selectedTierId ||
                  (!isExonere && selectedTierId === (row.tierId ?? ""))
                }
                onClick={() => void handleChangeTier()}
              >
                {busy
                  ? "Enregistrement…"
                  : isExonere
                    ? "Désexonérer"
                    : "Appliquer le tarif"}
              </button>
            </div>
          </div>
        ) : null}

        {step === "adjustPaid" ? (
          <form
            className={styles.stepBody}
            onSubmit={(event) => void handleAdjustSubmit(event)}
          >
            <label className={dialogStyles.field} htmlFor={amountId}>
              <span className={dialogStyles.label}>
                Total déjà encaissé (€)
              </span>
              <input
                ref={amountRef}
                id={amountId}
                className={styles.input}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amountInput}
                disabled={busy}
                onChange={(event) => setAmountInput(event.target.value)}
              />
            </label>
            <label className={dialogStyles.field} htmlFor={noteId}>
              <span className={dialogStyles.label}>
                Motif (optionnel)
              </span>
              <textarea
                id={noteId}
                className={styles.textarea}
                rows={2}
                value={note}
                disabled={busy}
                placeholder="Ex. erreur de saisie, trop-perçu…"
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={dialogStyles.buttonSecondary}
                disabled={busy}
                onClick={() => setStep("menu")}
              >
                Retour
              </button>
              <button
                type="submit"
                className={dialogStyles.button}
                disabled={busy || amountPaidCents == null}
              >
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        ) : null}

        {step === "confirmMarkPaid" ? (
          <div className={styles.stepBody}>
            <p className={styles.hint}>
              Enregistrer {formatEuros(row.remainingCents)} en espèces pour
              solder la cotisation de {row.displayName} ?
            </p>
            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={dialogStyles.buttonSecondary}
                disabled={busy}
                onClick={() => setStep("menu")}
              >
                Retour
              </button>
              <button
                type="button"
                className={dialogStyles.button}
                disabled={busy}
                onClick={() => void onMarkPaid()}
              >
                {busy ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </div>
        ) : null}

        {step === "confirmExonerate" ? (
          <div className={styles.stepBody}>
            <p className={styles.hint}>
              Exonérer {row.displayName} de cotisation ? Le tarif sera retiré.
            </p>
            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={dialogStyles.buttonSecondary}
                disabled={busy}
                onClick={() => setStep("menu")}
              >
                Retour
              </button>
              <button
                type="button"
                className={dialogStyles.buttonDanger}
                disabled={busy}
                onClick={() => void onExonerate()}
              >
                {busy ? "Enregistrement…" : "Exonérer"}
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className={dialogStyles.error} role="alert">
            {error}
          </p>
        ) : null}

        {step === "menu" ? (
          <div className={dialogStyles.actions}>
            <button
              type="button"
              className={dialogStyles.buttonSecondary}
              disabled={busy}
              onClick={onClose}
            >
              Fermer
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
