"use client";

import { useMemo, useState } from "react";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import {
  EquipmentFormDialog,
  type EquipmentFormValues,
} from "@/components/dashboard/EquipmentFormDialog";
import { useToast } from "@/components/ToastProvider";
import { bureauCapabilities } from "@/lib/auth/bureauPermissions";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import { useAuth } from "@/lib/firebase/AuthProvider";
import type { ClubRecord } from "@/lib/firebase/clubService";
import {
  createEquipmentItem,
  deleteEquipmentItem,
  equipmentConditionLabel,
  listEquipmentItems,
  updateEquipmentItem,
  type EquipmentItem,
} from "@/lib/firebase/equipmentService";
import { loadTeamsForClub, type TeamOption } from "@/lib/firebase/eventService";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import styles from "./page.module.css";

type EquipmentPageData = {
  items: EquipmentItem[];
  teams: TeamOption[];
};

type EquipmentFilters = {
  search: string;
  category: string;
  condition: string;
};

const DEFAULT_FILTERS: EquipmentFilters = {
  search: "",
  category: "all",
  condition: "all",
};

/** Charge inventaire + équipes pour l’assignation. */
async function loadEquipmentPageData(
  club: ClubRecord,
): Promise<EquipmentPageData> {
  const [items, teams] = await Promise.all([
    listEquipmentItems(club.id),
    loadTeamsForClub(club.id),
  ]);
  return { items, teams };
}

/** Contenu page Équipements (admin). */
export function EquipmentPageClient() {
  const { activeClub, activeClubRole, user } = useAuth();
  const caps = useMemo(
    () =>
      bureauCapabilities(activeClubRole, activeClub?.coachPermissions),
    [activeClubRole, activeClub?.coachPermissions],
  );
  const { showToast } = useToast();
  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub,
    loadEquipmentPageData,
    [],
  );

  const [filters, setFilters] = useState<EquipmentFilters>(DEFAULT_FILTERS);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of data?.items ?? []) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [data?.items]);

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of data?.teams ?? []) {
      map.set(team.id, team.name);
    }
    return map;
  }, [data?.teams]);

  const filteredItems = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return (data?.items ?? []).filter((item) => {
      if (filters.category !== "all" && item.category !== filters.category) {
        return false;
      }
      if (
        filters.condition !== "all" &&
        item.condition !== filters.condition
      ) {
        return false;
      }
      if (!search) return true;
      const haystack = [
        item.name,
        item.category,
        item.location,
        item.notes,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [data?.items, filters]);

  if (!caps.isAdmin) {
    return (
      <div className={transitionStyles.page}>
        <DashboardPageIntro
          eyebrow="Inventaire"
          heading="Équipements"
          lead="Réservé aux administrateurs du club."
        />
      </div>
    );
  }

  if (loading && !data) {
    return <DashboardSkeleton variant="members" />;
  }

  if (error && !data) {
    return (
      <div className={transitionStyles.page}>
        <DashboardPageIntro
          eyebrow="Inventaire"
          heading="Équipements"
          lead="Impossible de charger l’inventaire."
          onRefresh={reload}
        />
        <p className={styles.error} role="alert">
          {error}
        </p>
      </div>
    );
  }

  async function handleSubmit(values: EquipmentFormValues) {
    if (!activeClub || !user) return;
    setBusy(true);
    setActionError(null);
    try {
      if (dialogMode === "edit" && editingItem) {
        await updateEquipmentItem({
          clubId: activeClub.id,
          itemId: editingItem.id,
          uid: user.uid,
          input: values,
        });
        showToast("Équipement mis à jour.", "success");
      } else {
        await createEquipmentItem({
          clubId: activeClub.id,
          uid: user.uid,
          input: values,
        });
        showToast("Équipement créé.", "success");
      }
      setDialogMode(null);
      setEditingItem(null);
      await reload();
    } catch (submitError) {
      setActionError(
        submitError instanceof Error
          ? submitError.message
          : "Enregistrement impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item: EquipmentItem) {
    if (!activeClub) return;
    const confirmed = window.confirm(
      `Supprimer « ${item.name} » de l’inventaire ?`,
    );
    if (!confirmed) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteEquipmentItem({ clubId: activeClub.id, itemId: item.id });
      showToast("Équipement supprimé.", "success");
      await reload();
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : "Suppression impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={transitionStyles.page}>
      <DashboardPageIntro
        eyebrow="Inventaire"
        heading="Équipements"
        lead="Stock simple du club : quantités, état, emplacement."
        onRefresh={reload}
        refreshing={refreshing}
      />

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <input
            className={styles.search}
            type="search"
            placeholder="Rechercher…"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
          />
          <select
            className={styles.select}
            value={filters.category}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
            aria-label="Filtrer par catégorie"
          >
            <option value="all">Toutes catégories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={filters.condition}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                condition: event.target.value,
              }))
            }
            aria-label="Filtrer par état"
          >
            <option value="all">Tous états</option>
            <option value="ok">OK</option>
            <option value="use">Usé</option>
            <option value="hs">HS</option>
          </select>
        </div>
        <button
          type="button"
          className={styles.createButton}
          onClick={() => {
            setEditingItem(null);
            setActionError(null);
            setDialogMode("create");
          }}
        >
          Ajouter
        </button>
      </div>

      {actionError && !dialogMode ? (
        <p className={styles.error} role="alert">
          {actionError}
        </p>
      ) : null}

      {filteredItems.length === 0 ? (
        <p className={styles.empty}>Aucun équipement pour ces filtres.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Qté</th>
                <th>État</th>
                <th>Emplacement</th>
                <th>Équipe</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className={styles.nameCell}>
                      <strong>{item.name}</strong>
                      {item.notes ? (
                        <span className={styles.notes}>{item.notes}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{item.category || "—"}</td>
                  <td>{item.quantity}</td>
                  <td>
                    <span
                      className={styles.badge}
                      data-condition={item.condition}
                    >
                      {equipmentConditionLabel(item.condition)}
                    </span>
                  </td>
                  <td>{item.location || "—"}</td>
                  <td>
                    {item.assignedTeamId
                      ? (teamNameById.get(item.assignedTeamId) ?? "—")
                      : "—"}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.actionButton}
                        disabled={busy}
                        onClick={() => {
                          setEditingItem(item);
                          setActionError(null);
                          setDialogMode("edit");
                        }}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className={styles.actionButtonSecondary}
                        disabled={busy}
                        onClick={() => void handleDelete(item)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogMode ? (
        <EquipmentFormDialog
          key={editingItem?.id ?? "create"}
          mode={dialogMode}
          busy={busy}
          error={actionError}
          teams={data?.teams ?? []}
          initial={
            editingItem
              ? {
                  name: editingItem.name,
                  category: editingItem.category,
                  quantity: editingItem.quantity,
                  condition: editingItem.condition,
                  location: editingItem.location,
                  assignedTeamId: editingItem.assignedTeamId,
                  notes: editingItem.notes,
                }
              : undefined
          }
          onClose={() => {
            if (busy) return;
            setDialogMode(null);
            setEditingItem(null);
            setActionError(null);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
