"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import { useToast } from "@/components/ToastProvider";
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
import { loadTeamsForClub } from "@/lib/firebase/eventService";
import {
  createSeason,
  parseDateInput,
  updateSeason,
} from "@/lib/firebase/feeService";
import { defaultSeasonEndDate, isSeasonEndAfterMax, maxSeasonEndDate } from "@/lib/planning/seasonEnd";
import { HELLOASSO_PAYMENTS_LIVE } from "@/lib/featureFlags";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import { PlanningSelect } from "./PlanningSelect";
import styles from "./FeesConfigForm.module.css";

/** Props du formulaire de configuration cotisations. */
type FeesConfigFormProps = {
  initial: FeesConfig;
  clubId: string;
  uid: string;
  onSaved?: () => void;
};

const SEASON_LABEL_OPTIONS = buildSeasonLabelOptions();

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
  const { showToast } = useToast();
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
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [sportCategories, setSportCategories] = useState<string[]>([]);
  const [categoryLinkTierId, setCategoryLinkTierId] = useState<string | null>(
    null,
  );
  const [categoryDraft, setCategoryDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadTeamsForClub(clubId).then((teams) => {
      if (cancelled) return;
      const categories = [
        ...new Set(
          teams
            .map((team) => team.category.trim())
            .filter((category) => category.length > 0),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr"));
      setSportCategories(categories);
    });
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const canSave = useMemo(() => {
    if (!seasonLabel.trim()) return false;
    if (!seasonEndDate) return false;
    if (tiers.length === 0) return false;
    if (tiers.some((tier) => !tier.label.trim() || tier.amountCents <= 0)) return false;
    if (
      HELLOASSO_PAYMENTS_LIVE &&
      onlinePaymentEnabled &&
      !helloAssoOrganizationSlug.trim()
    ) {
      return false;
    }
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
    patch: Partial<Pick<FeeTierDraft, "label" | "amountCents" | "category">>,
  ) {
    setTiers((current) =>
      current.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier)),
    );
  }

  function addTier() {
    const id = `tier_${Date.now()}`;
    setTiers((current) => [
      ...current,
      { id, label: "Nouveau palier", amountCents: 0, category: "" },
    ]);
  }

  function removeTier(id: string) {
    setTiers((current) => current.filter((tier) => tier.id !== id));
    if (categoryLinkTierId === id) {
      setCategoryLinkTierId(null);
      setCategoryDraft("");
    }
  }

  function openCategoryLink(tier: FeeTierDraft) {
    setCategoryLinkTierId(tier.id);
    setCategoryDraft(tier.category);
  }

  function closeCategoryLink() {
    setCategoryLinkTierId(null);
    setCategoryDraft("");
  }

  function confirmCategoryLink() {
    if (!categoryLinkTierId) return;
    updateTier(categoryLinkTierId, { category: categoryDraft });
    closeCategoryLink();
  }

  const categoryLinkTier = categoryLinkTierId
    ? tiers.find((tier) => tier.id === categoryLinkTierId) ?? null
    : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

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
        enabled: HELLOASSO_PAYMENTS_LIVE && onlinePaymentEnabled,
        organizationSlug: helloAssoOrganizationSlug,
      });

      const parsedSeasonEnd = parseDateInput(seasonEndDate);
      if (parsedSeasonEnd && isSeasonEndAfterMax(parsedSeasonEnd)) {
        showToast(
          `La fin de saison ne peut pas dépasser le ${toDateInputValue(maxSeasonEndDate())} (31 juillet).`,
          "error",
        );
        savingRef.current = false;
        setSaving(false);
        return;
      }
      if (parsedSeasonEnd) {
        await updateClubSeasonEndDate({
          clubId,
          seasonEndDate: parsedSeasonEnd,
        });
      }

      showToast("Enregistré dans Firestore", "success");
      onSaved?.();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Échec de l’enregistrement.",
        "error",
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
            <PlanningSelect
              id="fees-season-label"
              value={seasonLabel}
              required
              options={SEASON_LABEL_OPTIONS.map((label) => ({
                value: label,
                label,
              }))}
              onChange={setSeasonLabel}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Devise</span>
            <PlanningSelect
              id="fees-currency"
              value={currency}
              options={FEE_CURRENCY_OPTIONS.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
              onChange={(next) => setCurrency(next as FeeCurrency)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Fin de saison (planning)</span>
            <input
              className={styles.input}
              type="date"
              value={seasonEndDate}
              max={toDateInputValue(maxSeasonEndDate())}
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
              Grille des paliers proposés aux membres. Associez une catégorie
              sport pour l’application intelligente.
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
              <div className={styles.libelleField}>
                <div className={styles.fieldHeader}>
                  <span className={styles.label}>Libellé</span>
                  <div className={styles.categoryLinkArea}>
                    <button
                      type="button"
                      className={styles.linkIconButton}
                      data-active={tier.category ? "true" : undefined}
                      onClick={() => openCategoryLink(tier)}
                      title={
                        tier.category
                          ? `Catégorie liée : ${tier.category}`
                          : "Lier à une catégorie sport (optionnel)"
                      }
                      aria-label={
                        tier.category
                          ? `Modifier la catégorie liée à ${tier.label}`
                          : `Lier ${tier.label} à une catégorie sport`
                      }
                    >
                      <svg
                        className={styles.linkIcon}
                        viewBox="0 0 256 256"
                        aria-hidden="true"
                      >
                        <path
                          fill="currentColor"
                          d="M208.49 47.51a72 72 0 0 0-101.82 0L86.34 67.84a8 8 0 0 0 11.32 11.32l20.33-20.33a56 56 0 0 1 79.18 79.18l-20.33 20.33a8 8 0 1 0 11.32 11.32l20.33-20.33a72 72 0 0 0 0-101.82Zm-49.65 128.33-20.33 20.33a56 56 0 0 1-79.18-79.18l20.33-20.33a8 8 0 1 0-11.32-11.32L47.51 106.67a72 72 0 1 0 101.82 101.82l20.33-20.33a8 8 0 0 0-11.32-11.32Zm8.49-76.37-56 56a8 8 0 0 1-11.32-11.32l56-56a8 8 0 0 1 11.32 11.32Z"
                        />
                      </svg>
                    </button>
                    {tier.category ? (
                      <span className={styles.categoryChip}>
                        <button
                          type="button"
                          className={styles.categoryChipLabel}
                          onClick={() => openCategoryLink(tier)}
                          title="Modifier la catégorie liée"
                        >
                          {tier.category}
                        </button>
                        <button
                          type="button"
                          className={styles.categoryChipRemove}
                          onClick={() =>
                            updateTier(tier.id, { category: "" })
                          }
                          aria-label={`Retirer la catégorie ${tier.category}`}
                        >
                          ×
                        </button>
                      </span>
                    ) : null}
                  </div>
                </div>
                <input
                  className={styles.input}
                  value={tier.label}
                  onChange={(e) =>
                    updateTier(tier.id, { label: e.target.value })
                  }
                  aria-label="Libellé"
                />
              </div>
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
                className={`${styles.ghostButton} ${styles.tierDelete}`}
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
              {onlinePaymentEnabled && HELLOASSO_PAYMENTS_LIVE
                ? "Activé"
                : "Désactivé"}
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={onlinePaymentEnabled}
              onChange={(e) => setOnlinePayment(e.target.checked)}
              disabled={!HELLOASSO_PAYMENTS_LIVE}
              aria-label="Activer le paiement en ligne HelloAsso"
            />
            <span className={styles.toggleTrack} aria-hidden="true" />
          </label>
        </div>
        <div className={styles.sectionBody}>
          {!HELLOASSO_PAYMENTS_LIVE ? (
            <p className={styles.sectionLead} role="status">
              Paiement en ligne HelloAsso — partenariat en cours. Vous pouvez
              préparer le slug de votre organisation ; l&apos;activation sera
              disponible prochainement.
            </p>
          ) : (
            <p className={styles.sectionLead}>
              Affiche le bouton « Payer en ligne » aux membres dans l&apos;app.
            </p>
          )}
          <label className={styles.field}>
            <span className={styles.label}>Slug organisation HelloAsso</span>
            <input
              className={styles.input}
              value={helloAssoOrganizationSlug}
              onChange={(event) => setHelloAssoOrganizationSlug(event.target.value)}
              placeholder="mon-club-asso"
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
      </div>

      {categoryLinkTier ? (
        <div
          className={dialogStyles.backdrop}
          role="presentation"
          onClick={closeCategoryLink}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === "Escape") closeCategoryLink();
          }}
        >
          <FadeScrollArea
            className={`${panelStyles.panel} ${dialogStyles.panel} ${styles.categoryDialog}`}
            viewportClassName={dialogStyles.body}
            data-tone="amber"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fees-tier-category-title"
            onClick={(mouseEvent) => mouseEvent.stopPropagation()}
          >
            <header className={dialogStyles.header}>
              <div>
                <p className={dialogStyles.eyebrow}>Tarifs</p>
                <h2
                  id="fees-tier-category-title"
                  className={dialogStyles.title}
                >
                  Lier « {categoryLinkTier.label} » à une catégorie ?
                </h2>
              </div>
              <button
                type="button"
                className={dialogStyles.closeButton}
                onClick={closeCategoryLink}
                aria-label="Fermer"
              >
                ×
              </button>
            </header>
            <p className={dialogStyles.hint}>
              Optionnel — utile pour l’application intelligente des
              cotisations selon la catégorie sport des membres.
            </p>
            <label className={styles.field}>
              <span className={styles.label}>Catégorie sport</span>
              <PlanningSelect
                id="fees-tier-category-dialog"
                value={categoryDraft}
                placeholder="Aucune"
                aria-label="Choisir une catégorie sport"
                options={[
                  { value: "", label: "Aucune" },
                  ...sportCategories.map((category) => ({
                    value: category,
                    label: category,
                  })),
                  ...(categoryDraft &&
                  !sportCategories.includes(categoryDraft)
                    ? [{ value: categoryDraft, label: categoryDraft }]
                    : []),
                ]}
                onChange={setCategoryDraft}
              />
            </label>
            <div className={styles.categoryDialogActions}>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={closeCategoryLink}
              >
                Annuler
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={confirmCategoryLink}
              >
                {categoryDraft ? "Lier" : "Ne pas lier"}
              </button>
            </div>
          </FadeScrollArea>
        </div>
      ) : null}
    </form>
  );
}
