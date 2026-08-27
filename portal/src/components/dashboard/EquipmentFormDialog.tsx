"use client";

import { FormEvent, useMemo, useState } from "react";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import {
  EquipmentConditions,
  type EquipmentCondition,
} from "@/lib/firebase/constants";
import type { EquipmentItemInput } from "@/lib/firebase/equipmentService";
import type { TeamOption } from "@/lib/firebase/eventService";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import { PlanningSelect } from "./PlanningSelect";
import styles from "./EquipmentFormDialog.module.css";

/** Valeurs du formulaire inventaire. */
export type EquipmentFormValues = EquipmentItemInput;

type EquipmentFormDialogProps = {
  mode: "create" | "edit";
  busy: boolean;
  error: string | null;
  teams: TeamOption[];
  initial?: Partial<EquipmentFormValues>;
  onClose: () => void;
  onSubmit: (values: EquipmentFormValues) => Promise<void>;
};

const CONDITION_OPTIONS = [
  { value: EquipmentConditions.ok, label: "OK" },
  { value: EquipmentConditions.use, label: "Usé" },
  { value: EquipmentConditions.hs, label: "HS" },
] as const;

/** Dialog création / édition d’un item d’inventaire. */
export function EquipmentFormDialog({
  mode,
  busy,
  error,
  teams,
  initial,
  onClose,
  onSubmit,
}: EquipmentFormDialogProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [condition, setCondition] = useState<EquipmentCondition>(
    initial?.condition ?? EquipmentConditions.ok,
  );
  const [location, setLocation] = useState(initial?.location ?? "");
  const [assignedTeamId, setAssignedTeamId] = useState(
    initial?.assignedTeamId ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const teamOptions = useMemo(
    () => [
      { value: "", label: "Aucune équipe" },
      ...teams.map((team) => ({ value: team.id, label: team.name })),
    ],
    [teams],
  );

  function requestClose() {
    if (busy) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    await onSubmit({
      name: name.trim(),
      category: category.trim(),
      quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
      condition,
      location: location.trim(),
      assignedTeamId: assignedTeamId.trim() || null,
      notes: notes.trim(),
    });
  }

  const title = mode === "create" ? "Nouvel équipement" : "Modifier l’équipement";
  const submitLabel =
    mode === "create"
      ? busy
        ? "Création…"
        : "Créer"
      : busy
        ? "Enregistrement…"
        : "Enregistrer";

  return (
    <div
      className={dialogStyles.backdrop}
      role="presentation"
      onClick={requestClose}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape") requestClose();
      }}
    >
      <FadeScrollArea
        className={`${panelStyles.panel} ${dialogStyles.panel} ${styles.panel}`}
        viewportClassName={`${dialogStyles.body} ${styles.panelContent}`}
        data-tone="blue"
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-form-title"
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>Inventaire</p>
            <h2 id="equipment-form-title" className={dialogStyles.title}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            className={dialogStyles.closeButton}
            onClick={requestClose}
            disabled={busy}
            aria-label="Fermer"
          >
            ×
          </button>
        </header>

        <form
          className={styles.form}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label className={dialogStyles.field}>
            <span className={dialogStyles.label}>Nom</span>
            <input
              className={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={busy}
              autoComplete="off"
              placeholder="ex. Ballon match"
            />
          </label>

          <label className={dialogStyles.field}>
            <span className={dialogStyles.label}>Catégorie</span>
            <input
              className={styles.input}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
              disabled={busy}
              autoComplete="off"
              placeholder="ex. Ballons"
            />
          </label>

          <div className={styles.row}>
            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>Quantité</span>
              <input
                className={styles.input}
                type="number"
                min={0}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
                disabled={busy}
              />
            </label>

            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>État</span>
              <PlanningSelect
                id="equipment-condition"
                value={condition}
                disabled={busy}
                options={CONDITION_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                onChange={(value) => setCondition(value as EquipmentCondition)}
              />
            </label>
          </div>

          <label className={dialogStyles.field}>
            <span className={dialogStyles.label}>Emplacement</span>
            <input
              className={styles.input}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              disabled={busy}
              autoComplete="off"
              placeholder="ex. Local U14"
            />
          </label>

          <label className={dialogStyles.field}>
            <span className={dialogStyles.label}>Équipe assignée</span>
            <PlanningSelect
              id="equipment-team"
              value={assignedTeamId}
              disabled={busy}
              options={teamOptions}
              onChange={setAssignedTeamId}
            />
          </label>

          <label className={dialogStyles.field}>
            <span className={dialogStyles.label}>Notes</span>
            <textarea
              className={styles.textarea}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={busy}
              rows={3}
              placeholder="Optionnel"
            />
          </label>

          {error ? (
            <p className={dialogStyles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={dialogStyles.actions}>
            <button
              type="button"
              className={dialogStyles.buttonSecondary}
              onClick={requestClose}
              disabled={busy}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={dialogStyles.button}
              disabled={busy}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </FadeScrollArea>
    </div>
  );
}
