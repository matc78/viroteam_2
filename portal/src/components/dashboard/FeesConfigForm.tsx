"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  buildSeasonLabelOptions,
  FEE_CURRENCY_OPTIONS,
  FEE_PAYMENT_METHOD_OPTIONS,
  FeeCurrency,
  FeePaymentMethod,
  FeesConfig,
  FeeTierDraft,
  tiersDraftToFeeTiers,
} from "@/lib/dashboard/feesConfig";
import { updateClubSeasonEndDate, updateOnlinePaymentConfig } from "@/lib/firebase/clubService";
import {
  createSeason,
  parseDateInput,
  updateSeason,
} from "@/lib/firebase/feeService";
import { defaultSeasonEndDate } from "@/lib/planning/seasonEnd";
import panelStyles from "./DashboardPanel.module.css";
import styles from "./FeesConfigForm.module.css";

/** Props du formulaire de configuration cotisations. */
type FeesConfigFormProps = {
  initial: FeesConfig;
  clubId: string;
  uid: string;
  onSaved?: () => void;
};

const SEASON_LABEL_OPTIONS = buildSeasonLabelOptions();
const TOAST_DURATION_MS = 3200;

/** Formate une date locale en `YYYY-MM-DD`. */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Formulaire de configuration cotisations (saison + HelloAsso → Firestore). */
export function FeesConfigForm({
  initial,
  clubId,
  uid,
  onSaved,
}: FeesConfigFormProps) {
  const [seasonId, setSeasonId] = useState(initial.seasonId);
  const [seasonLabel, setSeasonLabel] = useState(() =>
    SEASON_LABEL_OPTIONS.includes(initial.seasonLabel)
      ? initial.seasonLabel
      : SEASON_LABEL_OPTIONS[1] ?? SEASON_LABEL_OPTIONS[0],
  );
  const [currency, setCurrency] = useState<FeeCurrency>(() =>
    FEE_CURRENCY_OPTIONS.some((option) => option.id === initial.currency)
      ? (initial.currency as FeeCurrency)
      : "EUR",
  );
  const [paymentDeadline, setPaymentDeadline] = useState(
    initial.paymentDeadline,
  );
  const [seasonEndDate, setSeasonEndDate] = useState(
    initial.seasonEndDate || toDateInputValue(defaultSeasonEndDate()),
  );
  const [paymentInstructions, setPaymentInstructions] = useState(
    initial.paymentInstructions,
  );
  const [iban, setIban] = useState(initial.iban);
  const [paymentMethods, setPaymentMethods] = useState<FeePaymentMethod[]>(
    initial.paymentMethods,
  );
  const [tiers, setTiers] = useState<FeeTierDraft[]>(initial.tiers);
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(
    initial.onlinePaymentEnabled,
  );
  const [helloAssoOrganizationSlug, setHelloAssoOrganizationSlug] = useState(
    initial.helloAssoOrganizationSlug,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSave = useMemo(() => {
    if (!seasonLabel.trim()) return false;
    if (!seasonEndDate) return false;
    if (tiers.length === 0) return false;
    if (tiers.some((tier) => !tier.label.trim() || tier.amountCents <= 0)) return false;
    if (onlinePaymentEnabled && !helloAssoOrganizationSlug.trim()) return false;
    return true;
  }, [
    seasonLabel,
    seasonEndDate,
    tiers,
    onlinePaymentEnabled,
    helloAssoOrganizationSlug,
  ]);

  function setOnlinePayment(enabled: boolean) {
    setOnlinePaymentEnabled(enabled);
    if (!enabled) {
      setPaymentMethods((current) =>
        current.filter((method) => method !== "carte_bancaire"),
      );
    }
  }

  function toggleMethod(method: FeePaymentMethod) {
    setPaymentMethods((current) =>
      current.includes(method)
        ? current.filter((m) => m !== method)
        : [...current, method],
    );
  }

  function updateTier(
    id: string,
    patch: Partial<Pick<FeeTierDraft, "label" | "amountCents">>,
  ) {
    setTiers((current) =>
      current.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier)),
    );
  }

  function addTier() {
    const id = `tier_${Date.now()}`;
    setTiers((current) => [
      ...current,
      { id, label: "Nouveau palier", amountCents: 0 },
    ]);
  }

  function removeTier(id: string) {
    setTiers((current) => current.filter((tier) => tier.id !== id));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setToast(null);

    try {
      const seasonPayload = {
        seasonLabel: seasonLabel.trim(),
        currency,
        paymentDeadlineAt: parseDateInput(paymentDeadline),
        paymentInstructions: paymentInstructions.trim(),
        paymentMethods,
        iban,
        tiers: tiersDraftToFeeTiers(tiers),
      };

      if (seasonId) {
        await updateSeason(clubId, seasonId, seasonPayload);
      } else {
        const newId = await createSeason(clubId, {
          ...seasonPayload,
          createdBy: uid,
        });
        setSeasonId(newId);
      }

      await updateOnlinePaymentConfig({
        clubId,
        enabled: onlinePaymentEnabled,
        organizationSlug: helloAssoOrganizationSlug,
      });

      const parsedSeasonEnd = parseDateInput(seasonEndDate);
      if (parsedSeasonEnd) {
        await updateClubSeasonEndDate({
          clubId,
          seasonEndDate: parsedSeasonEnd,
        });
      }

      setToast("Enregistré dans Firestore");
      onSaved?.();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Échec de l’enregistrement.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
      {!seasonId ? (
        <p className={styles.sectionLead} role="status">
          Aucune saison active — enregistrez pour en créer une.
        </p>
      ) : null}

      <section
        className={`${panelStyles.panel} ${styles.section}`}
        data-tone="blue"
        aria-labelledby="fees-season"
      >
        <h2 id="fees-season" className={styles.sectionTitle}>
          Saison
        </h2>
        <p className={styles.sectionLead}>
          Libellé, fin de saison sportive, échéance de paiement et devise.
        </p>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.label}>Libellé saison</span>
            <select
              className={styles.input}
              value={seasonLabel}
              onChange={(e) => setSeasonLabel(e.target.value)}
              required
            >
              {SEASON_LABEL_OPTIONS.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Devise</span>
            <select
              className={styles.input}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as FeeCurrency)}
            >
              {FEE_CURRENCY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Fin de saison (planning)</span>
            <input
              className={styles.input}
              type="date"
              value={seasonEndDate}
              onChange={(e) => setSeasonEndDate(e.target.value)}
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Date limite de paiement</span>
            <input
              className={styles.input}
              type="date"
              value={paymentDeadline}
              onChange={(e) => setPaymentDeadline(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section
        className={`${panelStyles.panel} ${styles.section}`}
        data-tone="amber"
        aria-labelledby="fees-tiers"
      >
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="fees-tiers" className={styles.sectionTitle}>
              Tarifs
            </h2>
            <p className={styles.sectionLead}>
              Grille des paliers proposés aux membres.
            </p>
          </div>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={addTier}
          >
            Ajouter un palier
          </button>
        </div>
        <ul className={styles.tierList}>
          {tiers.map((tier, index) => (
            <li key={tier.id} className={styles.tierRow}>
              <span className={`badge badge-amber ${styles.tierBadge}`}>
                #{index + 1}
              </span>
              <label className={styles.field}>
                <span className={styles.label}>Libellé</span>
                <input
                  className={styles.input}
                  value={tier.label}
                  onChange={(e) =>
                    updateTier(tier.id, { label: e.target.value })
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
                  value={(tier.amountCents / 100).toFixed(2)}
                  onChange={(e) => {
                    const euros = Number.parseFloat(e.target.value);
                    updateTier(tier.id, {
                      amountCents: Number.isFinite(euros)
                        ? Math.round(euros * 100)
                        : 0,
                    });
                  }}
                />
              </label>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => removeTier(tier.id)}
                aria-label={`Supprimer ${tier.label}`}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section
        className={`${panelStyles.panel} ${styles.section}`}
        data-tone="green"
        aria-labelledby="fees-offline"
      >
        <h2 id="fees-offline" className={styles.sectionTitle}>
          Paiement hors ligne
        </h2>
        <p className={styles.sectionLead}>
          Consignes, IBAN et moyens acceptés hors HelloAsso.
        </p>
        <label className={styles.field}>
          <span className={styles.label}>Consignes de paiement</span>
          <textarea
            className={styles.textarea}
            rows={4}
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>IBAN (optionnel)</span>
          <input
            className={styles.input}
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            autoComplete="off"
          />
        </label>
        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>Moyens de paiement</legend>
          <div className={styles.chips}>
            {FEE_PAYMENT_METHOD_OPTIONS.filter(
              (option) =>
                option.id !== "carte_bancaire" || onlinePaymentEnabled,
            ).map((option) => {
              const selected = paymentMethods.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={
                    selected ? styles.chipSelected : styles.chip
                  }
                  aria-pressed={selected}
                  onClick={() => toggleMethod(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section
        className={`${panelStyles.panel} ${styles.section}`}
        data-tone="orange"
        data-enabled={onlinePaymentEnabled ? "true" : "false"}
        aria-labelledby="fees-helloasso"
      >
        <div className={styles.sectionTop}>
          <h2 id="fees-helloasso" className={styles.sectionTitle}>
            HelloAsso
          </h2>
          <label className={styles.toggle}>
            <span className={styles.toggleLabel}>
              {onlinePaymentEnabled ? "Activé" : "Désactivé"}
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={onlinePaymentEnabled}
              onChange={(e) => setOnlinePayment(e.target.checked)}
              aria-label="Activer le paiement en ligne HelloAsso"
            />
            <span className={styles.toggleTrack} aria-hidden="true" />
          </label>
        </div>
        <div className={styles.sectionBody}>
          <p className={styles.sectionLead}>
            Affiche le bouton « Payer en ligne » aux membres dans l’app.
          </p>
          <label className={styles.field}>
            <span className={styles.label}>Slug organisation HelloAsso</span>
            <input
              className={styles.input}
              value={helloAssoOrganizationSlug}
              onChange={(event) => setHelloAssoOrganizationSlug(event.target.value)}
              placeholder="mon-club-asso"
              disabled={!onlinePaymentEnabled}
            />
          </label>
        </div>
      </section>

      <div className={styles.footer}>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={!canSave || saving}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {toast ? (
          <p className={styles.toast} role="status">
            {toast}
          </p>
        ) : null}
      </div>
    </form>
  );
}
