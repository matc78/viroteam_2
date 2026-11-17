"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { eventEditCopy } from "@/lib/copy/eventEditCopy";
import type { PracticeLocation } from "@/lib/clubSetup/clubSetupDraft";
import type { ClubEventView } from "@/lib/firebase/eventService";
import {
  formatEventWhen,
  loadEditableEventDetails,
  updateClubEventDetails,
} from "@/lib/firebase/eventService";
import {
  buildEventDetailsPatch,
  hasEditableTitle,
  validateEventDetails,
  type EditableEventDetails,
} from "@/lib/planning/eventDetailsEdit";
import {
  PRACTICE_LOCATION_OTHER_VALUE,
  practiceLocationLabel,
  practiceLocationSelectValueFor,
} from "@/lib/planning/practiceLocationLabel";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import { PlanningSelect } from "./PlanningSelect";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import styles from "./EventDetailsEditDialog.module.css";

/** Props du dialog « Modifier l'événement ». */
type EventDetailsEditDialogProps = {
  clubId: string;
  event: ClubEventView;
  /** Lieux de pratique du club (dropdown + option Autre). */
  practiceLocations?: PracticeLocation[];
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Coach / admin : modifie titre (sans équipe), date, heures et lieux d'une
 * occurrence. Seuls les champs changés sont écrits ; le trigger push prévient
 * les convoqués.
 */
export function EventDetailsEditDialog({
  clubId,
  event,
  practiceLocations = [],
  onClose,
  onSaved,
}: EventDetailsEditDialogProps) {
  const { showToast } = useToast();
  const titleId = useId();
  const errorId = useId();
  const [original, setOriginal] = useState<EditableEventDetails | null>(null);
  const [form, setForm] = useState<EditableEventDetails | null>(null);
  const [locationSelectValue, setLocationSelectValue] = useState(
    PRACTICE_LOCATION_OTHER_VALUE,
  );
  const [customLocation, setCustomLocation] = useState("");
  const [locationSeeded, setLocationSeeded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLocationSeeded(false);
    loadEditableEventDetails(clubId, event.id)
      .then((details) => {
        if (cancelled) return;
        if (!details) {
          setLoadFailed(true);
          return;
        }
        setOriginal(details);
        setForm(details);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId, event.id]);

  useEffect(() => {
    if (!form || locationSeeded) return;
    const selectValue = practiceLocationSelectValueFor(
      practiceLocations,
      form.location,
    );
    setLocationSelectValue(selectValue);
    setCustomLocation(
      selectValue === PRACTICE_LOCATION_OTHER_VALUE ? form.location : "",
    );
    setLocationSeeded(true);
  }, [form, practiceLocations, locationSeeded]);

  function requestClose() {
    if (saving) return;
    onClose();
  }

  const dialogRef = useDialogA11y({ onClose: requestClose });

  const locationSelectOptions = useMemo(
    () => [
      ...practiceLocations.map((location, index) => ({
        value: String(index),
        label: practiceLocationLabel(location),
      })),
      {
        value: PRACTICE_LOCATION_OTHER_VALUE,
        label: eventEditCopy.locationOther,
      },
    ],
    [practiceLocations],
  );

  const useLocationDropdown = practiceLocations.length > 0;
  const useCustomLocationField =
    !useLocationDropdown ||
    locationSelectValue === PRACTICE_LOCATION_OTHER_VALUE;

  function update(patch: Partial<EditableEventDetails>) {
    setError(null);
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  /** Applique le choix dropdown / Autre sur `form.location`. */
  function applyLocationSelection(nextSelectValue: string) {
    setLocationSelectValue(nextSelectValue);
    setError(null);
    if (nextSelectValue === PRACTICE_LOCATION_OTHER_VALUE) {
      update({ location: customLocation });
      return;
    }
    const index = Number(nextSelectValue);
    const location = practiceLocations[index];
    if (!location) return;
    update({ location: practiceLocationLabel(location) });
  }

  function applyCustomLocation(nextValue: string) {
    setCustomLocation(nextValue);
    update({ location: nextValue });
  }

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (saving || !form || !original) return;
    let resolvedLocation = customLocation.trim() || form.location.trim();
    if (
      useLocationDropdown &&
      locationSelectValue !== PRACTICE_LOCATION_OTHER_VALUE
    ) {
      const selected = practiceLocations[Number(locationSelectValue)];
      if (selected) resolvedLocation = practiceLocationLabel(selected);
    }
    const nextForm = { ...form, location: resolvedLocation };
    const validationError = validateEventDetails(nextForm);
    if (validationError) {
      setError(validationError);
      return;
    }
    const patch = buildEventDetailsPatch(original, nextForm);
    if (Object.keys(patch).length === 0) {
      setError(eventEditCopy.noChanges);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateClubEventDetails(clubId, event.id, patch);
      showToast(eventEditCopy.saved, "success");
      onSaved();
      onClose();
    } catch {
      setError(eventEditCopy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const isMatch = form?.type === "match";
  const invalid = Boolean(error);

  return (
    <div
      className={dialogStyles.backdrop}
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`${panelStyles.panel} ${dialogStyles.panel} ${styles.panel}`}
        data-tone="cyan"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>{eventEditCopy.dialogEyebrow}</p>
            <h2 id={titleId} className={dialogStyles.title}>
              {eventEditCopy.dialogTitle}
            </h2>
            <p className={styles.eventName}>
              {event.title} · {formatEventWhen(event.startsAt)}
            </p>
          </div>
          <button
            type="button"
            className={dialogStyles.closeButton}
            disabled={saving}
            aria-label={eventEditCopy.back}
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        {!form ? (
          <div className={dialogStyles.body}>
            {loadFailed ? (
              <p className={dialogStyles.error} role="alert">
                {eventEditCopy.loadFailed}
              </p>
            ) : (
              <p className={dialogStyles.hint}>{eventEditCopy.loading}</p>
            )}
          </div>
        ) : (
          <form
            className={dialogStyles.body}
            onSubmit={handleSubmit}
            noValidate
          >
            {hasEditableTitle(form.type) ? (
              <div className={dialogStyles.field}>
                <label className={dialogStyles.label} htmlFor="edit-event-title">
                  {eventEditCopy.title}
                </label>
                <input
                  id="edit-event-title"
                  className={styles.input}
                  value={form.title}
                  onChange={(changeEvent) =>
                    update({ title: changeEvent.target.value })
                  }
                  disabled={saving}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? errorId : undefined}
                />
              </div>
            ) : null}

            <div className={dialogStyles.field}>
              <label className={dialogStyles.label} htmlFor="edit-event-day">
                {eventEditCopy.date}
              </label>
              <input
                id="edit-event-day"
                type="date"
                className={styles.input}
                value={form.day}
                onChange={(changeEvent) =>
                  update({ day: changeEvent.target.value })
                }
                required
                disabled={saving}
                aria-invalid={invalid}
                aria-describedby={invalid ? errorId : undefined}
              />
            </div>

            <div className={styles.grid2}>
              <div className={dialogStyles.field}>
                <label className={dialogStyles.label} htmlFor="edit-event-start">
                  {isMatch ? eventEditCopy.matchTime : eventEditCopy.start}
                </label>
                <input
                  id="edit-event-start"
                  type="time"
                  className={styles.input}
                  value={form.startTime}
                  onChange={(changeEvent) =>
                    update({ startTime: changeEvent.target.value })
                  }
                  required
                  disabled={saving}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? errorId : undefined}
                />
              </div>
              {isMatch ? (
                <div className={dialogStyles.field}>
                  <label
                    className={dialogStyles.label}
                    htmlFor="edit-event-meeting"
                  >
                    {eventEditCopy.meetingTime}
                  </label>
                  <input
                    id="edit-event-meeting"
                    type="time"
                    className={styles.input}
                    value={form.meetingTime ?? ""}
                    onChange={(changeEvent) =>
                      update({ meetingTime: changeEvent.target.value })
                    }
                    required
                    disabled={saving}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? errorId : undefined}
                  />
                </div>
              ) : (
                <div className={dialogStyles.field}>
                  <label className={dialogStyles.label} htmlFor="edit-event-end">
                    {eventEditCopy.end}
                  </label>
                  <input
                    id="edit-event-end"
                    type="time"
                    className={styles.input}
                    value={form.endTime ?? ""}
                    onChange={(changeEvent) =>
                      update({ endTime: changeEvent.target.value })
                    }
                    required
                    disabled={saving}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? errorId : undefined}
                  />
                </div>
              )}
            </div>

            {useLocationDropdown ? (
              <div className={dialogStyles.field}>
                <label
                  className={dialogStyles.label}
                  htmlFor="edit-event-location"
                >
                  {eventEditCopy.location}
                </label>
                <PlanningSelect
                  id="edit-event-location"
                  value={locationSelectValue}
                  options={locationSelectOptions}
                  onChange={applyLocationSelection}
                  required
                  disabled={saving}
                  placeholder={eventEditCopy.locationChoose}
                />
              </div>
            ) : null}

            {useCustomLocationField ? (
              <div className={dialogStyles.field}>
                <label
                  className={dialogStyles.label}
                  htmlFor="edit-event-location-custom"
                >
                  {useLocationDropdown
                    ? eventEditCopy.locationSpecify
                    : eventEditCopy.location}
                </label>
                <input
                  id="edit-event-location-custom"
                  className={styles.input}
                  value={customLocation}
                  onChange={(changeEvent) =>
                    applyCustomLocation(changeEvent.target.value)
                  }
                  placeholder={eventEditCopy.locationPlaceholder}
                  required
                  disabled={saving}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? errorId : undefined}
                />
              </div>
            ) : null}

            <div className={dialogStyles.field}>
              <label
                className={dialogStyles.label}
                htmlFor="edit-event-meeting-location"
              >
                {eventEditCopy.meetingLocation}
              </label>
              <input
                id="edit-event-meeting-location"
                className={styles.input}
                value={form.meetingLocation ?? ""}
                onChange={(changeEvent) =>
                  update({ meetingLocation: changeEvent.target.value })
                }
                disabled={saving}
              />
            </div>

            <p className={dialogStyles.hint}>
              {eventEditCopy.notifyHint}
              {event.seriesId ? ` ${eventEditCopy.seriesHint}` : ""}
            </p>

            {error ? (
              <p id={errorId} className={dialogStyles.error} role="alert">
                {error}
              </p>
            ) : null}

            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={dialogStyles.buttonSecondary}
                onClick={requestClose}
                disabled={saving}
              >
                {eventEditCopy.back}
              </button>
              <button
                type="submit"
                className={dialogStyles.button}
                disabled={saving}
              >
                {saving ? eventEditCopy.saving : eventEditCopy.save}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
