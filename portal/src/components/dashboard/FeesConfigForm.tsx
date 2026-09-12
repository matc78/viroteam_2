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
import type { StripeConnectStatus } from "@/lib/firebase/clubService";
import { loadTeamsForClub } from "@/lib/firebase/eventService";
import {
  createSeason,
  parseDateInput,
  updateSeason,
  updateSeasonPaymentMethods,
} from "@/lib/firebase/feeService";
import {
  createStripeConnectLink,
  getStripeConnectStatus,
} from "@/lib/firebase/callableService";
import {
  FeePaymentAnalytics,
  feePaymentErrorCode,
} from "@/lib/fees/feePaymentAnalytics";
import * as Sentry from "@sentry/nextjs";
import { defaultSeasonEndDate, isSeasonEndAfterMax, maxSeasonEndDate } from "@/lib/planning/seasonEnd";
import { STRIPE_PAYMENTS_LIVE } from "@/lib/featureFlags";
import {
  cardFeeCentsFromNet,
  cardGrossCentsFromNet,
} from "@/lib/stripe/cardGrossFromNet";
import { useRouter, useSearchParams } from "next/navigation";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import { PlanningSelect } from "./PlanningSelect";
import styles from "./FeesConfigForm.module.css";

/** Explication du montant CB affiché à côté du montant club. */
const CARD_FEE_INFO =
  "Le montant CB couvre les frais Stripe (1,5 % + 0,25 €) et 1 € pour la plateforme, pour que le club reçoive le montant saisi.";

/** Formate des centimes en euros (FR). */
function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** Props du formulaire de configuration cotisations. */
type FeesConfigFormProps = {
  initial: FeesConfig;
  clubId: string;
  uid: string;
  onSaved?: () => void;
};

const SEASON_LABEL_OPTIONS = buildSeasonLabelOptions();
/** Timeout d'ouverture Stripe Connect (callable + cold start). */
const STRIPE_CONNECT_OPEN_TIMEOUT_MS = 45_000;

type FeesFormSnapshot = {
  seasonLabel: string;
  currency: FeeCurrency;
  paymentDeadline: string;
  seasonEndDate: string;
  paymentInstructions: string;
  iban: string;
  paymentMethods: FeePaymentMethod[];
  tiers: FeeTierDraft[];
  onlinePaymentEnabled: boolean;
};

/** Instantané comparable pour détecter les changements non enregistrés. */
function buildFormSnapshot(params: {
  seasonLabel: string;
  currency: FeeCurrency;
  paymentDeadline: string;
  seasonEndDate: string;
  paymentInstructions: string;
  iban: string;
  paymentMethods: FeePaymentMethod[];
  tiers: FeeTierDraft[];
  onlinePaymentEnabled: boolean;
}): FeesFormSnapshot {
  return {
    seasonLabel: params.seasonLabel,
    currency: params.currency,
    paymentDeadline: params.paymentDeadline,
    seasonEndDate: params.seasonEndDate,
    paymentInstructions: params.paymentInstructions,
    iban: params.iban,
    paymentMethods: [...params.paymentMethods].sort(),
    tiers: params.tiers.map((tier) => ({
      id: tier.id,
      label: tier.label,
      amountCents: tier.amountCents,
      category: tier.category,
    })),
    onlinePaymentEnabled: params.onlinePaymentEnabled,
  };
}

/** Compare deux instantanés de formulaire cotisations. */
function snapshotsEqual(a: FeesFormSnapshot, b: FeesFormSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Libellé court du statut Connect Stripe. */
function stripeStatusLabel(status: StripeConnectStatus): string {
  switch (status) {
    case "complete":
      return "Prêt";
    case "pending":
      return "En cours";
    case "restricted":
      return "Restreint";
    default:
      return "Non connecté";
  }
}

/** Formate une date locale en `YYYY-MM-DD`. */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Formulaire de configuration cotisations (saison + Stripe Connect → Firestore). */
export function FeesConfigForm({
  initial,
  clubId,
  uid,
  onSaved,
}: FeesConfigFormProps) {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [stripeConnectStatus, setStripeConnectStatus] =
    useState<StripeConnectStatus>(initial.stripeConnectStatus);
  const [stripeAccountId, setStripeAccountId] = useState(
    initial.stripeConnectedAccountId,
  );
  const [stripeOpening, setStripeOpening] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const connectBusy = stripeOpening || statusBusy;
  const [saving, setSaving] = useState(false);
  const [feeInfoOpenTierId, setFeeInfoOpenTierId] = useState<string | null>(
    null,
  );
  const savingRef = useRef(false);
  const [sportCategories, setSportCategories] = useState<string[]>([]);
  const [categoryLinkTierId, setCategoryLinkTierId] = useState<string | null>(
    null,
  );
  const [categoryDraft, setCategoryDraft] = useState("");
  const feeInfoRootRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!feeInfoOpenTierId) return;
    function onPointerDown(event: PointerEvent) {
      const root = feeInfoRootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setFeeInfoOpenTierId(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFeeInfoOpenTierId(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [feeInfoOpenTierId]);

  const [savedSnapshot, setSavedSnapshot] = useState<FeesFormSnapshot>(() =>
    buildFormSnapshot({
      seasonLabel: SEASON_LABEL_OPTIONS.includes(initial.seasonLabel)
        ? initial.seasonLabel
        : SEASON_LABEL_OPTIONS[1] ?? SEASON_LABEL_OPTIONS[0] ?? "",
      currency: FEE_CURRENCY_OPTIONS.some((option) => option.id === initial.currency)
        ? (initial.currency as FeeCurrency)
        : "EUR",
      paymentDeadline: initial.paymentDeadline,
      seasonEndDate:
        initial.seasonEndDate || toDateInputValue(defaultSeasonEndDate()),
      paymentInstructions: initial.paymentInstructions,
      iban: initial.iban,
      paymentMethods: initial.paymentMethods,
      tiers: initial.tiers,
      onlinePaymentEnabled: initial.onlinePaymentEnabled,
    }),
  );

  const stripeReady = stripeConnectStatus === "complete";

  const currentSnapshot = useMemo(
    () =>
      buildFormSnapshot({
        seasonLabel,
        currency,
        paymentDeadline,
        seasonEndDate,
        paymentInstructions,
        iban,
        paymentMethods,
        tiers,
        onlinePaymentEnabled,
      }),
    [
      seasonLabel,
      currency,
      paymentDeadline,
      seasonEndDate,
      paymentInstructions,
      iban,
      paymentMethods,
      tiers,
      onlinePaymentEnabled,
    ],
  );

  const isDirty = !snapshotsEqual(currentSnapshot, savedSnapshot);

  const seasonValid = useMemo(() => {
    if (!seasonLabel.trim()) return false;
    if (!seasonEndDate) return false;
    if (tiers.length === 0) return false;
    if (tiers.some((tier) => !tier.label.trim() || tier.amountCents <= 0)) {
      return false;
    }
    return true;
  }, [seasonLabel, seasonEndDate, tiers]);

  const stripeGateOk = !(
    STRIPE_PAYMENTS_LIVE &&
    onlinePaymentEnabled &&
    !stripeReady
  );

  const onlineConfigDirty =
    onlinePaymentEnabled !== savedSnapshot.onlinePaymentEnabled ||
    JSON.stringify(currentSnapshot.paymentMethods) !==
      JSON.stringify(savedSnapshot.paymentMethods);

  /** Saison déjà créée : on peut sauver le toggle Stripe même si un palier brouillon est invalide. */
  const canSaveOnlineOnly =
    Boolean(seasonId) && onlineConfigDirty && stripeGateOk;

  const canSave =
    isDirty && stripeGateOk && (seasonValid || canSaveOnlineOnly);

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

  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    if (stripeParam !== "return" && stripeParam !== "refresh") return;
    let cancelled = false;
    void (async () => {
      try {
        const status = await getStripeConnectStatus({ clubId });
        if (cancelled) return;
        setStripeConnectStatus(status.status as StripeConnectStatus);
        setStripeAccountId(status.accountId ?? "");
        if (status.status === "complete") {
          showToast(
            "Compte Stripe prêt — active le toggle puis Enregistrer",
            "success",
          );
        } else if (stripeParam === "refresh") {
          showToast("Onboarding Stripe à reprendre", "error");
        }
      } catch {
        if (!cancelled) {
          showToast("Impossible de rafraîchir le statut Stripe", "error");
        }
      } finally {
        if (!cancelled) {
          router.replace("/fees");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId, searchParams, showToast, router]);

  function setOnlinePayment(enabled: boolean) {
    setOnlinePaymentEnabled(enabled);
    if (!enabled) {
      setPaymentMethods((current) =>
        current.filter((method) => method !== "carte_bancaire"),
      );
    } else if (!paymentMethods.includes("carte_bancaire")) {
      setPaymentMethods((current) => [...current, "carte_bancaire"]);
    }
  }

  async function handleConnectStripe() {
    if (connectBusy) return;
    setStripeOpening(true);
    let redirected = false;
    let timeoutId = 0;
    FeePaymentAnalytics.trackConnectStarted();
    try {
      const origin = window.location.origin;
      const result = await Promise.race([
        createStripeConnectLink({
          clubId,
          returnUrl: `${origin}/fees?stripe=return`,
          refreshUrl: `${origin}/fees?stripe=refresh`,
        }),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(
              new Error(
                "Délai dépassé — Stripe ne répond pas, réessaie dans un instant",
              ),
            );
          }, STRIPE_CONNECT_OPEN_TIMEOUT_MS);
        }),
      ]);
      if (result.url) {
        redirected = true;
        window.location.assign(result.url);
        return;
      }
      FeePaymentAnalytics.trackConnectFailed("missing_url");
      showToast("Lien Stripe indisponible", "error");
    } catch (err: unknown) {
      FeePaymentAnalytics.trackConnectFailed(feePaymentErrorCode(err));
      Sentry.captureException(err, {
        tags: { feature: "fees", area: "stripe_connect" },
      });
      showToast(
        err instanceof Error
          ? err.message
          : "Impossible de lancer Stripe Connect",
        "error",
      );
    } finally {
      window.clearTimeout(timeoutId);
      // Garder le loader jusqu'au changement de page (succès).
      if (!redirected) setStripeOpening(false);
    }
  }

  async function handleRefreshConnectStatus() {
    if (connectBusy) return;
    setStatusBusy(true);
    try {
      const status = await getStripeConnectStatus({ clubId });
      setStripeConnectStatus(status.status as StripeConnectStatus);
      setStripeAccountId(status.accountId ?? "");
      showToast(
        status.status === "complete"
          ? "Compte Stripe prêt"
          : "Statut Stripe mis à jour",
        "success",
      );
    } catch (err: unknown) {
      FeePaymentAnalytics.trackConnectFailed(feePaymentErrorCode(err));
      Sentry.captureException(err, {
        tags: { feature: "fees", area: "stripe_connect_status" },
      });
      showToast(
        err instanceof Error
          ? err.message
          : "Rafraîchissement Stripe échoué",
        "error",
      );
    } finally {
      setStatusBusy(false);
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

  async function persistOnlinePayment(enabled: boolean) {
    const methods = enabled
      ? paymentMethods.includes("carte_bancaire")
        ? paymentMethods
        : [...paymentMethods, "carte_bancaire" as FeePaymentMethod]
      : paymentMethods.filter((method) => method !== "carte_bancaire");

    if (seasonId) {
      await updateSeasonPaymentMethods(clubId, seasonId, methods);
    }
    await updateOnlinePaymentConfig({
      clubId,
      enabled: STRIPE_PAYMENTS_LIVE && enabled && stripeReady,
    });

    setPaymentMethods(methods);
    setOnlinePaymentEnabled(enabled);
    setSavedSnapshot(
      buildFormSnapshot({
        seasonLabel,
        currency,
        paymentDeadline,
        seasonEndDate,
        paymentInstructions,
        iban,
        paymentMethods: methods,
        tiers,
        onlinePaymentEnabled: STRIPE_PAYMENTS_LIVE && enabled && stripeReady,
      }),
    );
  }

  async function handleActivateOnlinePayments() {
    if (!stripeReady || !seasonId || connectBusy || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await persistOnlinePayment(true);
      showToast("Paiement CB Stripe activé pour les membres", "success");
      onSaved?.();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Impossible d’activer le paiement CB",
        "error",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    try {
      const enabled =
        STRIPE_PAYMENTS_LIVE && onlinePaymentEnabled && stripeReady;

      if (seasonValid) {
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

        await updateOnlinePaymentConfig({ clubId, enabled });

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

        setSavedSnapshot(
          buildFormSnapshot({
            seasonLabel: seasonLabel.trim(),
            currency,
            paymentDeadline,
            seasonEndDate,
            paymentInstructions: paymentInstructions.trim(),
            iban,
            paymentMethods,
            tiers,
            onlinePaymentEnabled: enabled,
          }),
        );
      } else if (canSaveOnlineOnly) {
        await persistOnlinePayment(onlinePaymentEnabled);
      } else {
        showToast(
          "Complète les paliers (montant > 0) avant d’enregistrer.",
          "error",
        );
        savingRef.current = false;
        setSaving(false);
        return;
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
        <ul className={styles.tierList} ref={feeInfoRootRef}>
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
              <div className={styles.amountRow}>
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
                {tier.amountCents > 0 ? (
                  <div className={styles.cardGross}>
                    <span className={styles.cardGrossArrow} aria-hidden>
                      →
                    </span>
                    <div className={styles.cardGrossText}>
                      <span className={styles.cardGrossLabel}>
                        CB en ligne :{" "}
                        {formatEuros(cardGrossCentsFromNet(tier.amountCents))}
                      </span>
                      <span className={styles.cardGrossFees}>
                        dont {formatEuros(cardFeeCentsFromNet(tier.amountCents))}{" "}
                        de frais
                      </span>
                    </div>
                    <div className={styles.infoWrap}>
                      <button
                        type="button"
                        className={styles.infoButton}
                        aria-label="Pourquoi ce montant CB ?"
                        aria-expanded={feeInfoOpenTierId === tier.id}
                        aria-controls={`fee-info-${tier.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setFeeInfoOpenTierId((current) =>
                            current === tier.id ? null : tier.id,
                          );
                        }}
                      >
                        i
                      </button>
                      {feeInfoOpenTierId === tier.id ? (
                        <div
                          id={`fee-info-${tier.id}`}
                          className={styles.infoPopover}
                          role="tooltip"
                        >
                          {CARD_FEE_INFO}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
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
        data-enabled={
          !STRIPE_PAYMENTS_LIVE
            ? "false"
            : onlinePaymentEnabled && stripeReady
              ? "true"
              : "setup"
        }
        aria-labelledby="fees-stripe"
      >
        <div className={styles.sectionTop}>
          <div className={styles.sectionTitleRow}>
            <h2 id="fees-stripe" className={styles.sectionTitle}>
              Stripe
            </h2>
            <span
              className={styles.connectStatusBadge}
              data-status={stripeConnectStatus}
              role="status"
            >
              {stripeStatusLabel(stripeConnectStatus)}
            </span>
          </div>
          <label className={styles.toggle}>
            <span className={styles.toggleLabel}>
              {onlinePaymentEnabled && STRIPE_PAYMENTS_LIVE && stripeReady
                ? "Activé"
                : "Désactivé"}
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={onlinePaymentEnabled}
              onChange={(e) => setOnlinePayment(e.target.checked)}
              disabled={!STRIPE_PAYMENTS_LIVE || !stripeReady}
              aria-label="Activer le paiement en ligne Stripe"
            />
            <span className={styles.toggleTrack} aria-hidden="true" />
          </label>
        </div>
        <div className={styles.sectionBody}>
          {!STRIPE_PAYMENTS_LIVE ? (
            <p className={styles.sectionLead} role="status">
              Paiement CB Stripe — active{" "}
              <code>NEXT_PUBLIC_STRIPE_LIVE=true</code> en local après avoir
              posé les secrets Functions.
            </p>
          ) : (
            <p className={styles.sectionLead}>
              Connecte le compte bancaire du club via Stripe Express, puis
              active le bouton « Payer en ligne » pour les membres.
            </p>
          )}
          {stripeAccountId ? (
            <p className={styles.connectAccountId}>
              Compte connecté · {stripeAccountId}
            </p>
          ) : null}
          {STRIPE_PAYMENTS_LIVE &&
          stripeReady &&
          !onlinePaymentEnabled &&
          seasonId ? (
            <button
              type="button"
              className={styles.activateButton}
              disabled={saving || connectBusy}
              onClick={() => void handleActivateOnlinePayments()}
            >
              Activer les paiements CB maintenant
            </button>
          ) : null}
          <div className={styles.chips}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={!STRIPE_PAYMENTS_LIVE || connectBusy}
              aria-busy={stripeOpening || undefined}
              onClick={() => void handleConnectStripe()}
            >
              {stripeOpening ? (
                <>
                  <span className={styles.buttonSpinner} aria-hidden="true" />
                  Ouverture…
                </>
              ) : stripeReady ? (
                "Mettre à jour Stripe"
              ) : stripeConnectStatus === "pending" ? (
                "Continuer l’onboarding"
              ) : (
                "Connecter Stripe"
              )}
            </button>
            {stripeAccountId ? (
              <button
                type="button"
                className={styles.chip}
                disabled={connectBusy}
                onClick={() => void handleRefreshConnectStatus()}
              >
                Rafraîchir le statut
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className={styles.footer}>
        <button
          type="submit"
          className={styles.primaryButton}
          data-ready={canSave ? "true" : undefined}
          disabled={!canSave || saving}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {canSave ? (
          <span className={styles.unsavedHint} role="status">
            Modifications non enregistrées
          </span>
        ) : isDirty && !seasonValid && !canSaveOnlineOnly ? (
          <span className={styles.unsavedHint} role="status">
            Un palier est incomplet (montant &gt; 0 requis)
          </span>
        ) : null}
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
