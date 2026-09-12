"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import {
  loadFeesTrackingData,
  suggestTierIdForCategories,
  type FeeTrackingRow,
} from "@/lib/dashboard/feesTracking";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import {
  ClubListenSets,
  useClubRealtimeReload,
  useIsPortalRouteActive,
} from "@/lib/dashboard/useClubRealtimeReload";
import {
  FeeAidStatuses,
  MemberFeeStatuses,
  type OfflinePaymentMethod,
} from "@/lib/firebase/constants";
import type { ClubRecord } from "@/lib/firebase/clubService";
import {
  applyMemberFeeChanges,
  adjustMemberFeePaidAmount,
  bulkValidateOfflinePayments,
  setFeeAidStatus,
  validateOfflinePayment,
  type FeeTier,
} from "@/lib/firebase/feeService";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import { CorrectMemberFeeDialog } from "@/components/dashboard/CorrectMemberFeeDialog";
import { useAuth } from "@/lib/firebase/AuthProvider";
import panelStyles from "./DashboardPanel.module.css";
import { FeesMultiFilter } from "./FeesMultiFilter";
import { PlanningSelect } from "./PlanningSelect";
import { RoleBadge } from "./RoleBadge";
import { isCurrentUserMember, YouChip } from "./YouChip";
import styles from "./FeesTrackingPanel.module.css";

/** Moyen hors-ligne par défaut (pas de choix à chaque encaissement). */
const DEFAULT_OFFLINE_METHOD: OfflinePaymentMethod = "especes";

/** Vue liste : à traiter, tous, payés, partiels, reste dû. */
type FeesStatusView = "pending" | "all" | "paid" | "partial" | "due";

/** Props du panneau suivi cotisations. */
type FeesTrackingPanelProps = {
  club: ClubRecord;
  /** Masque sélection et actions d’écriture (vue coach). */
  readOnly?: boolean;
};

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function tierOptionLabel(tier: FeeTier): string {
  return `${tier.label} — ${formatEuros(tier.amountCents)}`;
}

function feeStatusTone(status: string | null): string {
  if (status === MemberFeeStatuses.paye) return "ok";
  if (status === MemberFeeStatuses.partiel) return "pending";
  if (status === MemberFeeStatuses.exonere) return "gray";
  if (status === MemberFeeStatuses.aPayer) return "due";
  return "gray";
}

function matchesStatusView(row: FeeTrackingRow, view: FeesStatusView): boolean {
  switch (view) {
    case "pending":
      return row.needsAction;
    case "paid":
      return (
        row.status === MemberFeeStatuses.paye ||
        row.status === MemberFeeStatuses.exonere
      );
    case "partial":
      return row.status === MemberFeeStatuses.partiel;
    case "due":
      return row.remainingCents > 0;
    case "all":
      return true;
  }
}

function statusViewMetaLabel(view: FeesStatusView): string {
  switch (view) {
    case "pending":
      return "actions en attente";
    case "paid":
      return "payés / exonérés";
    case "partial":
      return "paiement partiel";
    case "due":
      return "avec reste dû";
    case "all":
      return "tous les membres";
  }
}

function statusViewEmptyLabel(view: FeesStatusView): string {
  switch (view) {
    case "pending":
      return "Rien à traiter — tout est à jour. Consulte Payés pour le détail.";
    case "paid":
      return "Aucun membre payé ou exonéré pour l’instant.";
    case "partial":
      return "Aucun paiement partiel.";
    case "due":
      return "Aucun reste dû.";
    case "all":
      return "Aucun membre ne correspond aux filtres.";
  }
}

/**
 * Suivi cotisations simplifié : tableau filtrable, actions directes
 * (assigner / exonérer / marquer payé / valider aides).
 */
export function FeesTrackingPanel({
  club,
  readOnly = false,
}: FeesTrackingPanelProps) {
  const { showToast } = useToast();
  const { data, loading, error, reload } = useAsyncClubResource(
    club,
    loadFeesTrackingData,
    [],
  );
  const feesActive = useIsPortalRouteActive(["/fees"]);
  useClubRealtimeReload({
    clubId: club.id,
    collections: ClubListenSets.fees,
    listenActiveMemberFees: true,
    onReload: reload,
    enabled: feesActive,
  });
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [sportCategoryFilters, setSportCategoryFilters] = useState<string[]>(
    [],
  );
  const [teamFilters, setTeamFilters] = useState<string[]>([]);
  const [statusView, setStatusView] = useState<FeesStatusView>("pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [busyBulk, setBusyBulk] = useState(false);
  const [correctRow, setCorrectRow] = useState<FeeTrackingRow | null>(null);
  const [correctError, setCorrectError] = useState<string | null>(null);
  const [correctBusy, setCorrectBusy] = useState(false);

  /** Garde la modale alignée sur les données temps réel. */
  useEffect(() => {
    if (!correctRow || !data) return;
    const fresh = data.rows.find((row) => row.memberId === correctRow.memberId);
    if (!fresh) {
      setCorrectRow(null);
      return;
    }
    if (
      fresh.status !== correctRow.status ||
      fresh.tierId !== correctRow.tierId ||
      fresh.amountPaidCents !== correctRow.amountPaidCents ||
      fresh.remainingCents !== correctRow.remainingCents ||
      fresh.amountDueCents !== correctRow.amountDueCents ||
      fresh.paymentMethodLabel !== correctRow.paymentMethodLabel
    ) {
      setCorrectRow(fresh);
    }
  }, [data, correctRow]);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    return data.rows.filter((row) => {
      if (!matchesStatusView(row, statusView)) return false;
      if (tierFilter !== "all" && row.tierId !== tierFilter) return false;
      if (
        sportCategoryFilters.length > 0 &&
        !sportCategoryFilters.some((category) =>
          row.sportCategories.includes(category),
        )
      ) {
        return false;
      }
      if (
        teamFilters.length > 0 &&
        !teamFilters.some((teamId) => row.resolvedTeamIds.includes(teamId))
      ) {
        return false;
      }
      if (!needle) return true;
      const haystack =
        `${row.firstName} ${row.lastName} ${row.displayName}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [
    data,
    search,
    statusView,
    tierFilter,
    sportCategoryFilters,
    teamFilters,
  ]);

  const payableSelectedCount = useMemo(() => {
    if (!data) return 0;
    let count = 0;
    for (const row of data.rows) {
      if (!selectedIds.has(row.memberId)) continue;
      if (!row.fee || !row.tierId) continue;
      if (row.status === MemberFeeStatuses.exonere) continue;
      if (row.remainingCents <= 0) continue;
      count += 1;
    }
    return count;
  }, [data, selectedIds]);

  /** Ouvre un mailto BCC vers la sélection (ignore les lignes sans e-mail). */
  function handleRelanceMailto() {
    if (!data || selectedIds.size === 0) return;

    const emails: string[] = [];
    let withoutEmail = 0;
    for (const row of data.rows) {
      if (!selectedIds.has(row.memberId)) continue;
      const email = row.email?.trim();
      if (email) {
        emails.push(email);
      } else {
        withoutEmail += 1;
      }
    }

    const uniqueEmails = [...new Set(emails)];
    if (uniqueEmails.length === 0) {
      showToast(
        withoutEmail > 0
          ? "Aucun e-mail sur la sélection."
          : "Sélection vide.",
        "error",
      );
      return;
    }

    const subject = encodeURIComponent(
      `Rappel cotisation — ${club.name} (saison ${data.season.seasonLabel})`,
    );
    const body = encodeURIComponent(
      `Bonjour,\n\nSauf erreur de notre part, votre cotisation pour la saison ${data.season.seasonLabel} n’est pas encore à jour.\n\nMerci de régulariser dès que possible.\n\nCordialement,\nLe bureau — ${club.name}\n`,
    );
    window.location.href = `mailto:?bcc=${uniqueEmails.map(encodeURIComponent).join(",")}&subject=${subject}&body=${body}`;

    if (withoutEmail > 0) {
      showToast(
        `${uniqueEmails.length} e-mail${uniqueEmails.length > 1 ? "s" : ""} · ${withoutEmail} sans adresse ignoré${withoutEmail > 1 ? "s" : ""}.`,
        "info",
      );
    }
  }

  const hasActiveFilters =
    search.trim() !== "" ||
    tierFilter !== "all" ||
    sportCategoryFilters.length > 0 ||
    teamFilters.length > 0;

  const smartApplyCandidates = useMemo(() => {
    if (!data || data.season.tiers.length === 0) return [];
    return data.rows.filter((row) => {
      if (row.status === MemberFeeStatuses.exonere) return false;
      if (row.tierId) return false;
      return Boolean(
        suggestTierIdForCategories(row.sportCategories, data.season.tiers),
      );
    });
  }, [data]);

  function clearFilters() {
    setSearch("");
    setTierFilter("all");
    setSportCategoryFilters([]);
    setTeamFilters([]);
  }

  async function handleSmartApply() {
    if (!data || busyBulk || busyMemberId != null) return;
    if (smartApplyCandidates.length === 0) return;
    const confirmed = window.confirm(
      `Application intelligente : assigner une cotisation à ${smartApplyCandidates.length} membre${smartApplyCandidates.length > 1 ? "s" : ""} selon leur catégorie sport ?`,
    );
    if (!confirmed) return;

    setBusyBulk(true);
    try {
      const changes = smartApplyCandidates.map((row) => {
        const tierId = suggestTierIdForCategories(
          row.sportCategories,
          data.season.tiers,
        )!;
        return {
          memberId: row.memberId,
          memberDisplayName: row.displayName,
          tierId,
          status: MemberFeeStatuses.aPayer,
          feeExists: Boolean(row.fee),
        };
      });
      await applyMemberFeeChanges({
        clubId: club.id,
        seasonId: data.season.id,
        changes,
      });
      showToast(
        changes.length === 1
          ? "Cotisation assignée"
          : `${changes.length} cotisations assignées`,
        "success",
      );
      await reload();
    } catch (smartError) {
      showToast(
        smartError instanceof Error
          ? smartError.message
          : "Échec de l’application intelligente",
        "error",
      );
    } finally {
      setBusyBulk(false);
    }
  }

  if (loading && !data) {
    return (
      <section className={`${panelStyles.panel} ${styles.section}`} data-tone="amber">
        <p className={styles.lead}>Chargement du suivi…</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className={`${panelStyles.panel} ${styles.section}`} data-tone="amber">
        <h2 className={styles.title}>Suivi des cotisations</h2>
        <p className={styles.lead}>
          Aucune saison active — configurez la saison pour suivre les
          cotisations.
        </p>
      </section>
    );
  }

  const allVisibleSelected =
    visibleRows.length > 0 &&
    visibleRows.every((row) => selectedIds.has(row.memberId));
  const someVisibleSelected =
    visibleRows.some((row) => selectedIds.has(row.memberId)) &&
    !allVisibleSelected;

  const busy = busyBulk || busyMemberId != null;

  function openCorrect(row: FeeTrackingRow) {
    if (busy) return;
    setCorrectError(null);
    setCorrectRow(row);
  }

  function closeCorrect() {
    if (correctBusy) return;
    setCorrectRow(null);
    setCorrectError(null);
  }

  async function correctChangeTier(tierId: string) {
    if (!data || !correctRow) return;
    const wasExonere = correctRow.status === MemberFeeStatuses.exonere;
    setCorrectBusy(true);
    setCorrectError(null);
    try {
      await applyMemberFeeChanges({
        clubId: club.id,
        seasonId: data.season.id,
        changes: [
          {
            memberId: correctRow.memberId,
            memberDisplayName: correctRow.displayName,
            tierId,
            status: MemberFeeStatuses.aPayer,
            feeExists: Boolean(correctRow.fee),
          },
        ],
      });
      const paidHint =
        correctRow.amountPaidCents > 0
          ? ` — statut recalculé (${formatEuros(correctRow.amountPaidCents)} déjà payé)`
          : "";
      setCorrectRow(null);
      showToast(
        wasExonere
          ? "Membre désexonéré — tarif assigné"
          : `Tarif mis à jour${paidHint}`,
        "success",
      );
      await reload();
    } catch (err) {
      setCorrectError(
        err instanceof Error ? err.message : "Échec du changement de tarif",
      );
    } finally {
      setCorrectBusy(false);
    }
  }

  async function correctAdjustPaid(values: {
    amountPaidCents: number;
    note: string | null;
  }) {
    if (!data || !correctRow) return;
    setCorrectBusy(true);
    setCorrectError(null);
    try {
      await adjustMemberFeePaidAmount({
        clubId: club.id,
        seasonId: data.season.id,
        memberId: correctRow.memberId,
        amountPaidCents: values.amountPaidCents,
        season: data.season,
        note: values.note,
      });
      setCorrectRow(null);
      showToast("Montant déjà payé mis à jour", "success");
      await reload();
    } catch (err) {
      setCorrectError(
        err instanceof Error ? err.message : "Échec de la correction",
      );
    } finally {
      setCorrectBusy(false);
    }
  }

  async function correctMarkPaid() {
    if (!data || !correctRow || correctRow.remainingCents <= 0) return;
    setCorrectBusy(true);
    setCorrectError(null);
    try {
      await validateOfflinePayment({
        clubId: club.id,
        seasonId: data.season.id,
        memberId: correctRow.memberId,
        offlineMethod: DEFAULT_OFFLINE_METHOD,
        amountCents: correctRow.remainingCents,
        season: data.season,
      });
      setCorrectRow(null);
      showToast(
        `Reste dû enregistré (${formatEuros(correctRow.remainingCents)})`,
        "success",
      );
      await reload();
    } catch (err) {
      setCorrectError(
        err instanceof Error ? err.message : "Échec du paiement",
      );
    } finally {
      setCorrectBusy(false);
    }
  }

  async function correctExonerate() {
    if (!data || !correctRow) return;
    setCorrectBusy(true);
    setCorrectError(null);
    try {
      await applyMemberFeeChanges({
        clubId: club.id,
        seasonId: data.season.id,
        changes: [
          {
            memberId: correctRow.memberId,
            memberDisplayName: correctRow.displayName,
            tierId: null,
            status: MemberFeeStatuses.exonere,
            feeExists: Boolean(correctRow.fee),
          },
        ],
      });
      setCorrectRow(null);
      showToast("Membre exonéré", "success");
      await reload();
    } catch (err) {
      setCorrectError(
        err instanceof Error ? err.message : "Échec de l’exonération",
      );
    } finally {
      setCorrectBusy(false);
    }
  }

  async function handleAidStatus(
    row: FeeTrackingRow,
    aidId: string,
    aidStatus:
      | typeof FeeAidStatuses.validated
      | typeof FeeAidStatuses.rejected,
  ) {
    if (!data || busy) return;
    setBusyMemberId(row.memberId);
    try {
      await setFeeAidStatus({
        clubId: club.id,
        seasonId: data.season.id,
        memberId: row.memberId,
        aidId,
        aidStatus,
        season: data.season,
      });
      showToast(
        aidStatus === FeeAidStatuses.validated ? "Aide validée" : "Aide refusée",
        "success",
      );
      await reload();
    } catch (aidError) {
      showToast(
        aidError instanceof Error ? aidError.message : "Échec de la validation",
        "error",
      );
    } finally {
      setBusyMemberId(null);
    }
  }

  async function applyBulkTier(tierIdRaw: string) {
    if (!data || busy || selectedIds.size === 0 || !tierIdRaw) return;
    setBusyBulk(true);
    try {
      const changes = data.rows
        .filter((row) => selectedIds.has(row.memberId))
        .map((row) => ({
          memberId: row.memberId,
          memberDisplayName: row.displayName,
          tierId: tierIdRaw,
          status: MemberFeeStatuses.aPayer,
          feeExists: Boolean(row.fee),
        }));
      await applyMemberFeeChanges({
        clubId: club.id,
        seasonId: data.season.id,
        changes,
      });
      setSelectedIds(new Set());
      showToast(
        changes.length === 1
          ? "Cotisation assignée"
          : `${changes.length} cotisations assignées`,
        "success",
      );
      await reload();
    } catch (bulkError) {
      showToast(
        bulkError instanceof Error
          ? bulkError.message
          : "Échec de l’assignation",
        "error",
      );
    } finally {
      setBusyBulk(false);
    }
  }

  async function handleBulkMarkPaid() {
    if (!data || busy || payableSelectedCount === 0) return;
    const confirmed = window.confirm(
      `Enregistrer le reste dû pour ${payableSelectedCount} membre${payableSelectedCount > 1 ? "s" : ""} (espèces) ?`,
    );
    if (!confirmed) return;

    setBusyBulk(true);
    try {
      const result = await bulkValidateOfflinePayments({
        clubId: club.id,
        seasonId: data.season.id,
        season: data.season,
        offlineMethod: DEFAULT_OFFLINE_METHOD,
        memberIds: [...selectedIds],
      });
      setSelectedIds(new Set());
      const parts = [
        result.applied > 0
          ? `${result.applied} paiement${result.applied > 1 ? "s" : ""} enregistré${result.applied > 1 ? "s" : ""}`
          : null,
        result.skipped > 0
          ? `${result.skipped} ignoré${result.skipped > 1 ? "s" : ""}`
          : null,
      ].filter(Boolean);
      showToast(parts.join(" · ") || "Aucun paiement enregistré", "success");
      await reload();
    } catch (paymentError) {
      showToast(
        paymentError instanceof Error
          ? paymentError.message
          : "Échec de l’encaissement",
        "error",
      );
    } finally {
      setBusyBulk(false);
    }
  }

  return (
    <section
      className={`${panelStyles.panel} ${styles.section}`}
      data-tone="amber"
      aria-labelledby="fees-tracking-title"
    >
      <h2 id="fees-tracking-title" className={styles.title}>
        Suivi des cotisations
      </h2>
      <p className={styles.lead}>
        {readOnly
          ? `Vue lecture — saison ${data.season.seasonLabel}.`
          : `Corrigez tarif, montant ou reste dû via le bouton Corriger — saison ${data.season.seasonLabel}.`}
      </p>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.summaryRow}>
        <div className={styles.summary} role="toolbar" aria-label="Vues de suivi">
          <button
            type="button"
            className={styles.summaryChip}
            data-tone="action"
            data-active={statusView === "pending" ? "true" : undefined}
            aria-pressed={statusView === "pending"}
            onClick={() => setStatusView("pending")}
          >
            <strong>{data.counts.needsAction}</strong> à traiter
          </button>
          <button
            type="button"
            className={styles.summaryChip}
            data-tone="due"
            data-active={statusView === "due" ? "true" : undefined}
            aria-pressed={statusView === "due"}
            onClick={() => setStatusView("due")}
          >
            <strong>{data.counts.remainingDue}</strong> avec reste dû
          </button>
          {data.counts.partial > 0 ? (
            <button
              type="button"
              className={styles.summaryChip}
              data-tone="partial"
              data-active={statusView === "partial" ? "true" : undefined}
              aria-pressed={statusView === "partial"}
              onClick={() => setStatusView("partial")}
            >
              <strong>{data.counts.partial}</strong> partiel
              {data.counts.partial > 1 ? "s" : ""}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.summaryChip}
            data-tone="paid"
            data-active={statusView === "paid" ? "true" : undefined}
            aria-pressed={statusView === "paid"}
            onClick={() => setStatusView("paid")}
          >
            <strong>{data.counts.paid}</strong> à jour
          </button>
          {data.counts.pendingAids > 0 ? (
            <span className={styles.summaryChip} data-tone="aid">
              <strong>{data.counts.pendingAids}</strong> aide
              {data.counts.pendingAids > 1 ? "s" : ""} à valider
            </span>
          ) : null}
        </div>
        {!readOnly && smartApplyCandidates.length > 0 ? (
          <button
            type="button"
            className={styles.smartButton}
            disabled={busy}
            title={`Assigner une cotisation à ${smartApplyCandidates.length} membre${smartApplyCandidates.length > 1 ? "s" : ""} selon la catégorie sport`}
            onClick={() => void handleSmartApply()}
          >
            {busyBulk ? "Application…" : "Application intelligente"}
          </button>
        ) : null}
      </div>

      <FadeScrollArea
        className={styles.toolbarWrap}
        viewportClassName={styles.toolbar}
        axis="horizontal"
      >
        <div className={styles.filters}>
          <label
            className={`${styles.field} ${styles.fieldSearch}`}
            data-active={search.trim() ? "true" : undefined}
          >
            <span className={styles.label}>Recherche</span>
            <input
              className={styles.input}
              type="search"
              value={search}
              placeholder="Nom du membre…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label
            className={styles.field}
            data-active={tierFilter !== "all" ? "true" : undefined}
          >
            <span className={styles.label}>Cotisation</span>
            <PlanningSelect
              id="fees-filter-tier"
              value={tierFilter}
              aria-label="Filtrer par catégorie de cotisation"
              options={[
                { value: "all", label: "Toutes" },
                ...data.season.tiers.map((tier) => ({
                  value: tier.tierId,
                  label: tier.label,
                })),
              ]}
              onChange={setTierFilter}
            />
          </label>

          <FeesMultiFilter
            id="fees-filter-sport-category"
            label="Catégorie"
            value={sportCategoryFilters}
            aria-label="Filtrer par catégories du sport"
            options={data.sportCategories.map((category) => ({
              value: category,
              label: category,
            }))}
            onChange={setSportCategoryFilters}
          />

          <FeesMultiFilter
            id="fees-filter-team"
            label="Équipe"
            value={teamFilters}
            aria-label="Filtrer par équipes"
            options={data.teams.map((team) => ({
              value: team.id,
              label: team.name,
            }))}
            onChange={setTeamFilters}
          />
        </div>

        <div className={styles.toolbarActions}>
          {hasActiveFilters ? (
            <button
              type="button"
              className={styles.clearFiltersButton}
              onClick={clearFilters}
              title="Annuler les filtres"
              aria-label="Annuler les filtres"
            >
              <svg
                className={styles.clearFiltersIcon}
                viewBox="0 0 256 256"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"
                />
              </svg>
            </button>
          ) : null}

          <button
            type="button"
            className={styles.toggleButton}
            aria-pressed={statusView === "all"}
            onClick={() =>
              setStatusView((current) =>
                current === "all" ? "pending" : "all",
              )
            }
          >
            {statusView === "all"
              ? "Voir seulement à traiter"
              : "Voir tous les membres"}
          </button>
        </div>
      </FadeScrollArea>

      {sportCategoryFilters.length > 0 || teamFilters.length > 0 ? (
        <div className={styles.activeChips} aria-label="Filtres actifs">
          {sportCategoryFilters.map((category) => (
            <button
              key={`cat-${category}`}
              type="button"
              className={styles.chip}
              onClick={() =>
                setSportCategoryFilters((current) =>
                  current.filter((item) => item !== category),
                )
              }
              title={`Retirer ${category}`}
            >
              <span>Catégorie · {category}</span>
              <span className={styles.chipRemove} aria-hidden="true">
                ×
              </span>
            </button>
          ))}
          {teamFilters.map((teamId) => {
            const teamName =
              data.teams.find((team) => team.id === teamId)?.name ?? teamId;
            return (
              <button
                key={`team-${teamId}`}
                type="button"
                className={styles.chip}
                onClick={() =>
                  setTeamFilters((current) =>
                    current.filter((item) => item !== teamId),
                  )
                }
                title={`Retirer ${teamName}`}
              >
                <span>Équipe · {teamName}</span>
                <span className={styles.chipRemove} aria-hidden="true">
                  ×
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className={styles.clearAllChips}
            onClick={clearFilters}
          >
            Tout effacer
          </button>
        </div>
      ) : null}

      <p className={styles.meta}>
        {visibleRows.length} membre{visibleRows.length > 1 ? "s" : ""}
        {" · "}
        {statusViewMetaLabel(statusView)}
      </p>

      {visibleRows.length === 0 ? (
        <p className={styles.empty} role="status">
          {statusViewEmptyLabel(statusView)}
        </p>
      ) : (
        <FadeScrollArea className={styles.tableWrap} axis="horizontal">
          <table className={styles.table}>
            <thead>
              <tr>
                {!readOnly ? (
                  <th scope="col" className={styles.checkCol}>
                    <input
                      className={styles.checkbox}
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = someVisibleSelected;
                      }}
                      aria-label="Tout sélectionner"
                      onChange={() => {
                        setSelectedIds((current) => {
                          if (allVisibleSelected) {
                            const next = new Set(current);
                            for (const row of visibleRows) {
                              next.delete(row.memberId);
                            }
                            return next;
                          }
                          const next = new Set(current);
                          for (const row of visibleRows) {
                            next.add(row.memberId);
                          }
                          return next;
                        });
                      }}
                    />
                  </th>
                ) : null}
                <th scope="col">Nom</th>
                <th scope="col">Statut</th>
                <th scope="col">Cotisation</th>
                <th scope="col">Équipe</th>
                <th scope="col">Paiement</th>
                <th scope="col">Montants</th>
                {!readOnly ? <th scope="col">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <FeeTrackingRowItem
                  key={row.memberId}
                  row={row}
                  tiers={data.season.tiers}
                  checked={selectedIds.has(row.memberId)}
                  busy={busyMemberId === row.memberId}
                  disabled={busy}
                  readOnly={readOnly}
                  onToggleSelect={() => {
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(row.memberId)) next.delete(row.memberId);
                      else next.add(row.memberId);
                      return next;
                    });
                  }}
                  onCorrect={() => openCorrect(row)}
                  onAidStatus={(aidId, status) =>
                    void handleAidStatus(row, aidId, status)
                  }
                />
              ))}
            </tbody>
          </table>
        </FadeScrollArea>
      )}

      {!readOnly && selectedIds.size > 0 ? (
        <div
          className={styles.bar}
          role="region"
          aria-label="Actions sur la sélection"
        >
          <div className={styles.barSummary}>
            <strong>
              {selectedIds.size} sélectionné
              {selectedIds.size > 1 ? "s" : ""}
            </strong>
            <button
              type="button"
              className={styles.linkButton}
              disabled={busy}
              onClick={() => setSelectedIds(new Set())}
            >
              Tout désélectionner
            </button>
          </div>
          <div className={styles.barActions}>
            {data.season.tiers.length > 0 ? (
              <label className={styles.selectField}>
                <span className={styles.selectLabel}>Assigner cotisation</span>
                <PlanningSelect
                  id="fees-bulk-tier"
                  value=""
                  aria-label="Assigner une cotisation à la sélection"
                  disabled={busy}
                  placement="up"
                  placeholder="Choisir…"
                  options={data.season.tiers.map((tier) => ({
                    value: tier.tierId,
                    label: tierOptionLabel(tier),
                  }))}
                  onChange={(next) => {
                    if (!next) return;
                    void applyBulkTier(next);
                  }}
                />
              </label>
            ) : null}
            <button
              type="button"
              className={styles.barSecondaryButton}
              disabled={busy}
              onClick={handleRelanceMailto}
            >
              Relancer par e-mail
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={busy || payableSelectedCount === 0}
              title={
                payableSelectedCount === 0
                  ? "Aucun membre avec reste dû"
                  : `Enregistrer le reste dû (${payableSelectedCount})`
              }
              onClick={() => void handleBulkMarkPaid()}
            >
              {busyBulk
                ? "Enregistrement…"
                : `Marquer payé (${payableSelectedCount})`}
            </button>
          </div>
        </div>
      ) : null}

      {correctRow ? (
        <CorrectMemberFeeDialog
          clubId={club.id}
          seasonId={data.season.id}
          row={correctRow}
          tiers={data.season.tiers}
          busy={correctBusy}
          error={correctError}
          onClose={closeCorrect}
          onChangeTier={correctChangeTier}
          onAdjustPaid={correctAdjustPaid}
          onMarkPaid={correctMarkPaid}
          onExonerate={correctExonerate}
        />
      ) : null}
    </section>
  );
}

type FeeTrackingRowItemProps = {
  row: FeeTrackingRow;
  tiers: FeeTier[];
  checked: boolean;
  busy: boolean;
  disabled: boolean;
  readOnly?: boolean;
  onToggleSelect: () => void;
  onCorrect: () => void;
  onAidStatus: (
    aidId: string,
    status:
      | typeof FeeAidStatuses.validated
      | typeof FeeAidStatuses.rejected,
  ) => void;
};

function FeeTrackingRowItem({
  row,
  tiers,
  checked,
  busy,
  disabled,
  readOnly = false,
  onToggleSelect,
  onCorrect,
  onAidStatus,
}: FeeTrackingRowItemProps) {
  const { user } = useAuth();
  const isSelf = isCurrentUserMember(row, user?.uid);
  const isExonere = row.status === MemberFeeStatuses.exonere;
  const tierLabel = row.tierId
    ? (tiers.find((tier) => tier.tierId === row.tierId)?.label ?? "Cotisation")
    : null;

  return (
    <>
      <tr
        data-done={row.needsAction ? undefined : "true"}
        data-checked={checked ? "true" : undefined}
      >
        {!readOnly ? (
          <td className={styles.checkCol}>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              aria-label={`Sélectionner ${row.displayName}`}
              onChange={onToggleSelect}
            />
          </td>
        ) : null}
        <td>
          <span className={styles.rowName}>
            {row.displayName}
            <RoleBadge role={row.role} size="sm" iconOnly />
            {isSelf ? <YouChip /> : null}
          </span>
          {row.sportCategories.length > 0 ? (
            <span className={styles.rowSub}>
              {row.sportCategories.join(" · ")}
            </span>
          ) : null}
        </td>
        <td>
          <span
            className={styles.badge}
            data-tone={feeStatusTone(row.status)}
          >
            {row.feeStatusLabel}
          </span>
          {row.pendingAids.length > 0 ? (
            <span className={`${styles.badge} ${styles.badgeWarning}`}>
              Aide
            </span>
          ) : null}
        </td>
        <td>
          {tierLabel ?? (
            <span className={styles.muted}>
              {isExonere ? "—" : "Non assignée"}
            </span>
          )}
        </td>
        <td>
          {row.teamNames.length > 0 ? (
            row.teamNames.join(", ")
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </td>
        <td>
          {row.paymentMethodLabel ? (
            <span className={styles.paymentMethod}>{row.paymentMethodLabel}</span>
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </td>
        <td>
          {isExonere || !row.tierId ? (
            <span className={styles.muted}>—</span>
          ) : (
            <span className={styles.amounts}>
              <span className={styles.amountLine}>
                Dû {formatEuros(row.amountDueCents)}
              </span>
              <span
                className={styles.amountLine}
                data-paid={row.amountPaidCents > 0 ? "true" : undefined}
              >
                Payé {formatEuros(row.amountPaidCents)}
              </span>
              {row.remainingCents > 0 ? (
                <span className={styles.remaining}>
                  Reste {formatEuros(row.remainingCents)}
                </span>
              ) : (
                <span className={styles.soldHint}>Soldé</span>
              )}
            </span>
          )}
        </td>
        {!readOnly ? (
          <td>
            <div className={styles.rowActions}>
              <button
                type="button"
                className={styles.outlineButton}
                disabled={disabled}
                onClick={onCorrect}
                title={
                  isExonere
                    ? "Désexonérer ou corriger"
                    : "Corriger tarif, montant, reste dû…"
                }
              >
                {busy ? "…" : "Corriger"}
              </button>
            </div>
          </td>
        ) : null}
      </tr>

      {row.pendingAids.map((aid) => (
        <tr key={`${row.memberId}-${aid.id}`} className={styles.aidRow}>
          {!readOnly ? <td /> : null}
          <td colSpan={readOnly ? 6 : 6}>
            <span className={styles.aidLabel}>
              Aide · {aid.label || aid.type} — {formatEuros(aid.amountCents)}
            </span>
          </td>
          {!readOnly ? (
            <td>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  className={styles.actionButton}
                  disabled={disabled}
                  onClick={() => onAidStatus(aid.id, FeeAidStatuses.validated)}
                >
                  Valider
                </button>
                <button
                  type="button"
                  className={styles.ghostButton}
                  disabled={disabled}
                  onClick={() => onAidStatus(aid.id, FeeAidStatuses.rejected)}
                >
                  Refuser
                </button>
              </div>
            </td>
          ) : null}
        </tr>
      ))}
    </>
  );
}
