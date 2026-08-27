"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import {
  loadFeesTrackingData,
  suggestTierIdForCategories,
  type FeeTrackingRow,
} from "@/lib/dashboard/feesTracking";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import {
  FeeAidStatuses,
  MemberFeeStatuses,
  type OfflinePaymentMethod,
} from "@/lib/firebase/constants";
import type { ClubRecord } from "@/lib/firebase/clubService";
import {
  applyMemberFeeChanges,
  bulkValidateOfflinePayments,
  setFeeAidStatus,
  validateOfflinePayment,
  type FeeTier,
} from "@/lib/firebase/feeService";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import panelStyles from "./DashboardPanel.module.css";
import { FeesMultiFilter } from "./FeesMultiFilter";
import { PlanningSelect } from "./PlanningSelect";
import styles from "./FeesTrackingPanel.module.css";

/** Moyen hors-ligne par défaut (pas de choix à chaque encaissement). */
const DEFAULT_OFFLINE_METHOD: OfflinePaymentMethod = "especes";

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

/**
 * Suivi cotisations simplifié : tableau filtrable, actions directes
 * (assigner / exonérer / marquer payé / valider aides).
 */
export function FeesTrackingPanel({ club }: FeesTrackingPanelProps) {
  const { showToast } = useToast();
  const { data, loading, error, reload } = useAsyncClubResource(
    club,
    loadFeesTrackingData,
    [],
  );
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [sportCategoryFilters, setSportCategoryFilters] = useState<string[]>(
    [],
  );
  const [teamFilters, setTeamFilters] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [busyBulk, setBusyBulk] = useState(false);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    return data.rows.filter((row) => {
      if (!showAll && !row.needsAction) return false;
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
    showAll,
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

  async function assignTier(row: FeeTrackingRow, tierId: string) {
    if (!tierId || busy) return;
    setBusyMemberId(row.memberId);
    try {
      await applyMemberFeeChanges({
        clubId: club.id,
        seasonId: data!.season.id,
        changes: [
          {
            memberId: row.memberId,
            memberDisplayName: row.displayName,
            tierId,
            status: MemberFeeStatuses.aPayer,
            feeExists: Boolean(row.fee),
          },
        ],
      });
      showToast("Cotisation assignée", "success");
      await reload();
    } catch (assignError) {
      showToast(
        assignError instanceof Error
          ? assignError.message
          : "Échec de l’assignation",
        "error",
      );
    } finally {
      setBusyMemberId(null);
    }
  }

  async function exonerate(row: FeeTrackingRow) {
    if (busy) return;
    const confirmed = window.confirm(
      `Exonérer ${row.displayName} de cotisation ?`,
    );
    if (!confirmed) return;
    setBusyMemberId(row.memberId);
    try {
      await applyMemberFeeChanges({
        clubId: club.id,
        seasonId: data!.season.id,
        changes: [
          {
            memberId: row.memberId,
            memberDisplayName: row.displayName,
            tierId: null,
            status: MemberFeeStatuses.exonere,
            feeExists: Boolean(row.fee),
          },
        ],
      });
      showToast("Membre exonéré", "success");
      await reload();
    } catch (exonerateError) {
      showToast(
        exonerateError instanceof Error
          ? exonerateError.message
          : "Échec de l’exonération",
        "error",
      );
    } finally {
      setBusyMemberId(null);
    }
  }

  async function markPaid(row: FeeTrackingRow) {
    if (!data || busy || !row.fee || row.remainingCents <= 0) return;
    setBusyMemberId(row.memberId);
    try {
      await validateOfflinePayment({
        clubId: club.id,
        seasonId: data.season.id,
        memberId: row.memberId,
        offlineMethod: DEFAULT_OFFLINE_METHOD,
        amountCents: row.remainingCents,
        season: data.season,
      });
      showToast(
        `Payé enregistré (${formatEuros(row.remainingCents)})`,
        "success",
      );
      await reload();
    } catch (payError) {
      showToast(
        payError instanceof Error ? payError.message : "Échec du paiement",
        "error",
      );
    } finally {
      setBusyMemberId(null);
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
        Assignez un tarif, marquez comme payé, ou validez une aide — saison{" "}
        {data.season.seasonLabel}.
      </p>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.summaryRow}>
        <div className={styles.summary} role="status">
          <span className={styles.summaryChip} data-tone="action">
            <strong>{data.counts.needsAction}</strong> à traiter
          </span>
          <span className={styles.summaryChip} data-tone="due">
            <strong>{data.counts.remainingDue}</strong> avec reste dû
          </span>
          {data.counts.pendingAids > 0 ? (
            <span className={styles.summaryChip} data-tone="aid">
              <strong>{data.counts.pendingAids}</strong> aide
              {data.counts.pendingAids > 1 ? "s" : ""} à valider
            </span>
          ) : null}
        </div>
        {smartApplyCandidates.length > 0 ? (
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
            aria-pressed={showAll}
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? "Voir seulement à traiter" : "Voir tous les membres"}
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
        {!showAll ? " · actions en attente" : null}
      </p>

      {visibleRows.length === 0 ? (
        <p className={styles.empty} role="status">
          {showAll
            ? "Aucun membre ne correspond aux filtres."
            : "Rien à traiter — tout est à jour."}
        </p>
      ) : (
        <FadeScrollArea className={styles.tableWrap} axis="horizontal">
          <table className={styles.table}>
            <thead>
              <tr>
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
                <th scope="col">Nom</th>
                <th scope="col">Statut</th>
                <th scope="col">Cotisation</th>
                <th scope="col">Équipe</th>
                <th scope="col">Reste dû</th>
                <th scope="col">Actions</th>
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
                  onToggleSelect={() => {
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(row.memberId)) next.delete(row.memberId);
                      else next.add(row.memberId);
                      return next;
                    });
                  }}
                  onAssignTier={(tierId) => void assignTier(row, tierId)}
                  onExonerate={() => void exonerate(row)}
                  onMarkPaid={() => void markPaid(row)}
                  onAidStatus={(aidId, status) =>
                    void handleAidStatus(row, aidId, status)
                  }
                />
              ))}
            </tbody>
          </table>
        </FadeScrollArea>
      )}

      {selectedIds.size > 0 ? (
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
    </section>
  );
}

type FeeTrackingRowItemProps = {
  row: FeeTrackingRow;
  tiers: FeeTier[];
  checked: boolean;
  busy: boolean;
  disabled: boolean;
  onToggleSelect: () => void;
  onAssignTier: (tierId: string) => void;
  onExonerate: () => void;
  onMarkPaid: () => void;
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
  onToggleSelect,
  onAssignTier,
  onExonerate,
  onMarkPaid,
  onAidStatus,
}: FeeTrackingRowItemProps) {
  const isExonere = row.status === MemberFeeStatuses.exonere;
  const needsTier = !row.tierId && !isExonere;
  const canMarkPaid =
    Boolean(row.fee && row.tierId) && !isExonere && row.remainingCents > 0;
  const tierLabel = row.tierId
    ? (tiers.find((tier) => tier.tierId === row.tierId)?.label ?? "Cotisation")
    : null;

  const tierSelectOptions = tiers.map((tier) => ({
    value: tier.tierId,
    label: tierOptionLabel(tier),
  }));

  return (
    <>
      <tr
        data-done={row.needsAction ? undefined : "true"}
        data-checked={checked ? "true" : undefined}
      >
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
        <td>
          <span className={styles.rowName}>{row.displayName}</span>
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
            <span className={styles.muted}>{isExonere ? "—" : "Non assignée"}</span>
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
          {row.remainingCents > 0 ? (
            <span className={styles.remaining}>
              {formatEuros(row.remainingCents)}
            </span>
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </td>
        <td>
          <div className={styles.rowActions}>
            {needsTier ? (
              <>
                <PlanningSelect
                  id={`fees-tier-${row.memberId}`}
                  value=""
                  placeholder="Choisir…"
                  aria-label={`Assigner cotisation ${row.displayName}`}
                  disabled={disabled || tiers.length === 0}
                  options={tierSelectOptions}
                  onChange={(next) => {
                    if (next) onAssignTier(next);
                  }}
                />
                <button
                  type="button"
                  className={styles.ghostButton}
                  disabled={disabled}
                  onClick={onExonerate}
                >
                  Exonérer
                </button>
              </>
            ) : null}

            {canMarkPaid ? (
              <button
                type="button"
                className={styles.actionButton}
                disabled={disabled}
                onClick={onMarkPaid}
              >
                {busy ? "…" : `Payé (${formatEuros(row.remainingCents)})`}
              </button>
            ) : null}

            {!row.needsAction ? (
              <span className={styles.doneHint}>À jour</span>
            ) : null}
          </div>
        </td>
      </tr>

      {row.pendingAids.map((aid) => (
        <tr key={`${row.memberId}-${aid.id}`} className={styles.aidRow}>
          <td />
          <td colSpan={5}>
            <span className={styles.aidLabel}>
              Aide · {aid.label || aid.type} — {formatEuros(aid.amountCents)}
            </span>
          </td>
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
        </tr>
      ))}
    </>
  );
}
