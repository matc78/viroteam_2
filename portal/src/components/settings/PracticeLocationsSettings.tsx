"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import type { PracticeLocation } from "@/lib/clubSetup/clubSetupDraft";
import { PracticeLocationCategories } from "@/lib/clubSetup/constants";
import {
  searchFrenchCities,
  searchFrenchStreets,
  type FrenchAddressSuggestion,
} from "@/lib/clubSetup/frenchAddressService";
import {
  emptyPracticeLocationForm,
  isPracticeLocationNameTaken,
  practiceLocationDetails,
  practiceLocationFormError,
  practiceLocationFromForm,
  practiceLocationToForm,
  type PracticeLocationFormValues,
} from "@/lib/clubSetup/practiceLocationForm";
import {
  samePracticeLocation,
  updateClubPracticeLocations,
} from "@/lib/firebase/clubService";
import shared from "./settingsShared.module.css";
import styles from "./PracticeLocationsSettings.module.css";

type PracticeLocationsSettingsProps = {
  clubId: string;
  sport: string;
  locations: PracticeLocation[];
  /** Recharge le club actif après enregistrement. */
  onSaved: () => Promise<void>;
};

/** Délai avant d’interroger l’autocomplétion d’adresse (ms). */
const SUGGESTION_DEBOUNCE_MS = 250;

/**
 * Lieux de pratique du club : liste (modifier / supprimer avec confirmation
 * sur place) et formulaire d’ajout avec autocomplétion ville / adresse.
 */
export function PracticeLocationsSettings({
  clubId,
  sport,
  locations,
  onSaved,
}: PracticeLocationsSettingsProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState<PracticeLocationFormValues>(() =>
    emptyPracticeLocationForm(sport),
  );
  /** Index du lieu en cours de modification, `null` = ajout. */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  const categories = PracticeLocationCategories.forSport(sport);
  const categoryOptions =
    form.category && !categories.includes(form.category)
      ? [...categories, form.category]
      : categories;
  const isOther = form.category === PracticeLocationCategories.other;
  const nameTaken = isPracticeLocationNameTaken(
    locations,
    form.name,
    editingIndex,
  );
  const formError =
    practiceLocationFormError(form) ??
    (nameTaken ? "Un lieu porte déjà ce nom." : null);

  function update(patch: Partial<PracticeLocationFormValues>) {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function resetForm() {
    setForm(emptyPracticeLocationForm(sport));
    setEditingIndex(null);
    setShowErrors(false);
    setError(null);
  }

  /**
   * Applique [update] à la liste relue côté serveur (transaction), puis
   * recharge le club. Un échec du seul rechargement n’annule pas le succès.
   */
  async function persist(
    update: (current: PracticeLocation[]) => PracticeLocation[],
    successMessage: string,
  ) {
    setBusy(true);
    setError(null);
    try {
      await updateClubPracticeLocations({ clubId, update });
    } catch (saveError) {
      setError(
        saveError instanceof StaleLocationError
          ? "Ce lieu a été modifié ailleurs entre-temps : recharge la page puis réessaie."
          : "Enregistrement impossible. Vérifie ta connexion et réessaie.",
      );
      setBusy(false);
      return false;
    }
    showToast(successMessage, "success");
    try {
      await onSaved();
    } catch {
      // Lieu bien enregistré : la liste se mettra à jour au prochain chargement.
    }
    setBusy(false);
    return true;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (formError) {
      setShowErrors(true);
      return;
    }
    const location = practiceLocationFromForm(form);
    const editing = editingIndex === null ? null : locations[editingIndex];
    const saved = await persist(
      (current) => {
        if (!editing) return [...current, location];
        const index = indexOfLocation(current, editing);
        return current.map((item, itemIndex) =>
          itemIndex === index ? location : item,
        );
      },
      editing ? "Lieu modifié." : "Lieu ajouté.",
    );
    if (saved) resetForm();
  }

  function startEditing(index: number) {
    const location = locations[index];
    if (!location) return;
    setForm(practiceLocationToForm(location, sport));
    setEditingIndex(index);
    setConfirmingDelete(null);
    setShowErrors(false);
    setError(null);
    nameInputRef.current?.focus();
  }

  async function handleDelete(index: number) {
    const target = locations[index];
    if (!target) return;
    const saved = await persist((current) => {
      const found = indexOfLocation(current, target);
      return current.filter((_, itemIndex) => itemIndex !== found);
    }, "Lieu supprimé.");
    if (!saved) return;
    setConfirmingDelete(null);
    if (editingIndex === index) resetForm();
    else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  }

  const visibleError = error ?? (showErrors ? formError : null);

  return (
    <div className={styles.root}>
      {locations.length === 0 ? (
        <p className={shared.hint}>
          Aucun lieu enregistré. Ajoute le gymnase ou le stade du club : il
          sera proposé à la création des événements.
        </p>
      ) : (
        <ul className={styles.list} aria-label="Lieux de pratique du club">
          {locations.map((location, index) => {
            const confirming = confirmingDelete === index;
            const details = practiceLocationDetails(location);
            return (
              <li
                key={`${location.name}-${index}`}
                className={styles.row}
                data-editing={editingIndex === index ? "true" : undefined}
              >
                <div className={styles.rowText}>
                  <p className={styles.rowName}>{location.name}</p>
                  {details ? (
                    <p className={styles.rowDetails}>{details}</p>
                  ) : null}
                </div>
                {confirming ? (
                  <span className={styles.rowActions}>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => void handleDelete(index)}
                    >
                      Supprimer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setConfirmingDelete(null)}
                    >
                      Annuler
                    </Button>
                  </span>
                ) : (
                  <span className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      disabled={busy}
                      aria-label={`Modifier ${location.name}`}
                      title="Modifier"
                      onClick={() => startEditing(index)}
                    >
                      <Icon name="pencil" size={16} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      data-tone="danger"
                      disabled={busy}
                      aria-label={`Supprimer ${location.name}`}
                      title="Supprimer"
                      onClick={() => setConfirmingDelete(index)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form
        className={styles.form}
        aria-labelledby={`${formId}-title`}
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        <p id={`${formId}-title`} className={styles.formTitle}>
          {editingIndex === null
            ? "Ajouter un lieu"
            : `Modifier « ${locations[editingIndex]?.name ?? ""} »`}
        </p>
        <div className={styles.grid}>
          <label className={shared.field}>
            <span className={shared.label}>Nom du lieu</span>
            <input
              ref={nameInputRef}
              className={shared.input}
              value={form.name}
              placeholder="Ex. Gymnase Jean Macé"
              disabled={busy}
              aria-invalid={showErrors && (!form.name.trim() || nameTaken)}
              onChange={(event) => update({ name: event.target.value })}
            />
          </label>
          <label className={shared.field}>
            <span className={shared.label}>Catégorie</span>
            <select
              className={shared.select}
              value={form.category}
              disabled={busy}
              onChange={(event) =>
                update({
                  category: event.target.value,
                  ...(event.target.value !== PracticeLocationCategories.other
                    ? { categoryCustom: "" }
                    : {}),
                })
              }
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {PracticeLocationCategories.label(category)}
                </option>
              ))}
            </select>
          </label>
          {isOther ? (
            <label className={`${shared.field} ${styles.wide}`}>
              <span className={shared.label}>Précise la catégorie</span>
              <input
                className={shared.input}
                value={form.categoryCustom}
                placeholder="Ex. Plage, salle polyvalente…"
                disabled={busy}
                aria-invalid={showErrors && !form.categoryCustom.trim()}
                onChange={(event) =>
                  update({ categoryCustom: event.target.value })
                }
              />
            </label>
          ) : null}
          <SuggestedInput
            label="Ville"
            value={form.city}
            placeholder="Ex. Viroflay"
            disabled={busy}
            invalid={showErrors && !form.city.trim()}
            onChange={(city) => update({ city })}
            search={(query, signal) => searchFrenchCities(query, signal)}
            onPick={(suggestion) => update({ city: suggestion.city })}
          />
          <SuggestedInput
            label="Adresse"
            value={form.address}
            placeholder="Ex. 12 rue de la République"
            disabled={busy}
            invalid={showErrors && !form.address.trim()}
            onChange={(address) => update({ address })}
            search={(query, signal) =>
              searchFrenchStreets({ query, city: form.city, signal })
            }
            onPick={(suggestion) =>
              update({
                address: suggestion.street || suggestion.label,
                ...(suggestion.city ? { city: suggestion.city } : {}),
              })
            }
          />
        </div>
        {visibleError ? (
          <p className={shared.error} role="alert">
            {visibleError}
          </p>
        ) : null}
        <div className={shared.actions}>
          {editingIndex !== null ? (
            <button
              type="button"
              className={shared.resetButton}
              disabled={busy}
              onClick={resetForm}
            >
              Annuler
            </button>
          ) : null}
          <button type="submit" className={shared.saveButton} disabled={busy}>
            {busy
              ? "Enregistrement…"
              : editingIndex === null
                ? "Ajouter le lieu"
                : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

type SuggestedInputProps = {
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
  search: (
    query: string,
    signal: AbortSignal,
  ) => Promise<FrenchAddressSuggestion[]>;
  onPick: (suggestion: FrenchAddressSuggestion) => void;
};

/** Champ texte avec suggestions d’adresse (GeoPF) sous le champ. */
function SuggestedInput({
  label,
  value,
  placeholder,
  disabled,
  invalid,
  onChange,
  search,
  onPick,
}: SuggestedInputProps) {
  const [suggestions, setSuggestions] = useState<FrenchAddressSuggestion[]>(
    [],
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listId = useId();

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  /** Annule la recherche en attente ou en cours (la liste ne rouvre pas). */
  function cancelSearch() {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
  }

  /** Ferme la liste, sauf si le focus part sur une suggestion (Tab). */
  function closeUnlessInside(next: EventTarget | null) {
    const list = document.getElementById(listId);
    if (next instanceof Node && list?.contains(next)) return;
    cancelSearch();
    // Laisse le clic sur une suggestion aboutir avant de fermer.
    setTimeout(() => setSuggestions([]), 150);
  }

  function scheduleSearch(query: string) {
    cancelSearch();
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      void search(query, controller.signal).then((results) => {
        if (!controller.signal.aborted) setSuggestions(results);
      });
    }, SUGGESTION_DEBOUNCE_MS);
  }

  return (
    <label className={`${shared.field} ${styles.suggestField}`}>
      <span className={shared.label}>{label}</span>
      <input
        className={shared.input}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-invalid={invalid}
        aria-controls={suggestions.length > 0 ? listId : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          scheduleSearch(event.target.value);
        }}
        onBlur={(event) => closeUnlessInside(event.relatedTarget)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            cancelSearch();
            setSuggestions([]);
          }
        }}
      />
      {suggestions.length > 0 ? (
        <div
          id={listId}
          className={styles.suggestions}
          onBlur={(event) => closeUnlessInside(event.relatedTarget)}
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              className={styles.suggestionItem}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onPick(suggestion);
                setSuggestions([]);
              }}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

/** Le lieu visé n’est plus dans la liste du serveur (modifié ailleurs). */
class StaleLocationError extends Error {}

/** Position de [target] dans [current] (même contenu), sinon erreur. */
function indexOfLocation(
  current: PracticeLocation[],
  target: PracticeLocation,
): number {
  const index = current.findIndex((item) => samePracticeLocation(item, target));
  if (index < 0) throw new StaleLocationError();
  return index;
}
