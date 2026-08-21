"use client";

import { FormEvent, useMemo, useState } from "react";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import { teamCategoriesForSport } from "@/lib/teams/teamCategories";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import { PlanningSelect } from "./PlanningSelect";
import styles from "./TeamFormDialog.module.css";

const CUSTOM_CATEGORY = "__custom__";

/** Valeurs soumises par le formulaire équipe. */
export type TeamFormValues = {
  name: string;
  category: string;
};

type TeamFormDialogProps = {
  mode: "create" | "edit";
  sport: string;
  busy: boolean;
  error: string | null;
  initialName?: string;
  initialCategory?: string;
  onClose: () => void;
  onSubmit: (values: TeamFormValues) => Promise<void>;
};

/** Dialog création / édition d’équipe (nom + catégorie). */
export function TeamFormDialog({
  mode,
  sport,
  busy,
  error,
  initialName = "",
  initialCategory = "",
  onClose,
  onSubmit,
}: TeamFormDialogProps) {
  const suggestedCategories = useMemo(
    () => teamCategoriesForSport(sport),
    [sport],
  );

  const initialInList =
    initialCategory.trim() !== "" &&
    suggestedCategories.includes(initialCategory.trim());

  const [name, setName] = useState(initialName);
  const [categoryChoice, setCategoryChoice] = useState(() => {
    if (initialInList) return initialCategory.trim();
    if (initialCategory.trim()) return CUSTOM_CATEGORY;
    return suggestedCategories[0] ?? CUSTOM_CATEGORY;
  });
  const [customCategory, setCustomCategory] = useState(() =>
    initialInList ? "" : initialCategory.trim(),
  );

  const categoryOptions = useMemo(() => {
    const options = suggestedCategories.map((category) => ({
      value: category,
      label: category,
    }));
    if (
      initialCategory.trim() &&
      !suggestedCategories.includes(initialCategory.trim())
    ) {
      options.unshift({
        value: initialCategory.trim(),
        label: initialCategory.trim(),
      });
    }
    options.push({ value: CUSTOM_CATEGORY, label: "Autre…" });
    return options;
  }, [suggestedCategories, initialCategory]);

  function requestClose() {
    if (busy) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const category =
      categoryChoice === CUSTOM_CATEGORY
        ? customCategory.trim()
        : categoryChoice.trim();
    await onSubmit({ name: name.trim(), category });
  }

  const title = mode === "create" ? "Nouvelle équipe" : "Modifier l’équipe";
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
        data-tone="green"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-form-title"
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>Équipes</p>
            <h2 id="team-form-title" className={dialogStyles.title}>
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
              placeholder="ex. Équipe A"
            />
          </label>

          <label className={dialogStyles.field}>
            <span className={dialogStyles.label}>Catégorie</span>
            <PlanningSelect
              id="team-form-category"
              value={categoryChoice}
              disabled={busy}
              options={categoryOptions}
              onChange={setCategoryChoice}
            />
          </label>

          {categoryChoice === CUSTOM_CATEGORY ? (
            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>Catégorie personnalisée</span>
              <input
                className={styles.input}
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                required
                disabled={busy}
                autoComplete="off"
                placeholder="ex. U14 Filles"
              />
            </label>
          ) : null}

          <p className={styles.hint}>
            La catégorie sert au planning et aux paliers de cotisation.
          </p>

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

/** Dialog de création d’équipe. */
export function CreateTeamDialog(
  props: Omit<TeamFormDialogProps, "mode">,
) {
  return <TeamFormDialog {...props} mode="create" />;
}

/** Dialog d’édition d’équipe. */
export function EditTeamDialog(props: Omit<TeamFormDialogProps, "mode">) {
  return <TeamFormDialog {...props} mode="edit" />;
}
