"use client";

import { FormEvent, useId, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { convocationsCopy } from "@/lib/copy/convocationsCopy";
import {
  updateEventConvocations,
  type EventConvocationScope,
} from "@/lib/firebase/callableService";
import type {
  ClubEventView,
  PlanningGuestDirectoryEntry,
  TeamOption,
} from "@/lib/firebase/eventService";
import { formatEventWhen } from "@/lib/firebase/eventService";
import {
  buildConvocationRows,
  computeConvocationDeltas,
} from "@/lib/planning/eventConvocations";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import { ConvocationChecklist } from "./ConvocationChecklist";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import styles from "./EventConvocationsDialog.module.css";

/** Props du dialog « Gérer les convoqués ». */
type EventConvocationsDialogProps = {
  clubId: string;
  event: ClubEventView;
  /** Équipes du club (roster joueurs des équipes de l'événement). */
  teams: TeamOption[];
  /** Annuaire noms / avatars indexé par memberId et accountUid. */
  directory: Record<string, PlanningGuestDirectoryEntry>;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Coach / admin : coche / décoche les joueurs convoqués d'un événement à venir
 * puis envoie les deltas à `updateEventConvocations` (portée au choix si série).
 */
export function EventConvocationsDialog({
  clubId,
  event,
  teams,
  directory,
  onClose,
  onSaved,
}: EventConvocationsDialogProps) {
  const { showToast } = useToast();
  const titleId = useId();
  const errorId = useId();
  const rows = useMemo(
    () => buildConvocationRows({ event, teams, directory }),
    [event, teams, directory],
  );
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(
    () => new Set(rows.filter((row) => row.convoked).map((row) => row.key)),
  );
  const [scope, setScope] = useState<EventConvocationScope>("occurrence");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSeries = Boolean(event.seriesId);

  function requestClose() {
    if (saving) return;
    onClose();
  }

  const dialogRef = useDialogA11y({ onClose: requestClose });

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (saving) return;
    const { excludeIds, reintegrateIds } = computeConvocationDeltas(
      rows,
      checkedKeys,
    );
    if (excludeIds.length === 0 && reintegrateIds.length === 0) {
      setError(convocationsCopy.noChanges);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = await updateEventConvocations({
        clubId,
        eventId: event.id,
        excludeIds,
        reintegrateIds,
        scope: isSeries ? scope : "occurrence",
      });
      showToast(convocationsCopy.saved(result.updatedCount), "success");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : convocationsCopy.saveFailed,
      );
    } finally {
      setSaving(false);
    }
  }

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
            <p className={dialogStyles.eyebrow}>
              {convocationsCopy.dialogEyebrow}
            </p>
            <h2 id={titleId} className={dialogStyles.title}>
              {convocationsCopy.dialogTitle}
            </h2>
            <p className={styles.eventName}>
              {event.title} · {formatEventWhen(event.startsAt)}
            </p>
          </div>
          <button
            type="button"
            className={dialogStyles.closeButton}
            disabled={saving}
            aria-label={convocationsCopy.close}
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        <form className={dialogStyles.body} onSubmit={handleSubmit} noValidate>
          <ConvocationChecklist
            idPrefix={`convocations-${event.id}`}
            items={rows}
            checkedKeys={checkedKeys}
            onChange={(next) => {
              setError(null);
              setCheckedKeys(next);
            }}
            legend={convocationsCopy.listLegend}
            hint={convocationsCopy.listHint}
            emptyLabel={convocationsCopy.emptyRoster}
            disabled={saving}
            errorId={errorId}
            invalid={Boolean(error)}
          />

          {isSeries ? (
            <fieldset className={styles.scopeFieldset} disabled={saving}>
              <legend className={styles.scopeLegend}>
                {convocationsCopy.scopeLegend}
              </legend>
              <label className={styles.scopeOption}>
                <input
                  type="radio"
                  name="convocation-scope"
                  value="occurrence"
                  checked={scope === "occurrence"}
                  onChange={() => setScope("occurrence")}
                />
                <span>{convocationsCopy.scopeOccurrence}</span>
              </label>
              <label className={styles.scopeOption}>
                <input
                  type="radio"
                  name="convocation-scope"
                  value="following"
                  checked={scope === "following"}
                  onChange={() => setScope("following")}
                />
                <span>{convocationsCopy.scopeFollowing}</span>
              </label>
              <p className={dialogStyles.hint}>{convocationsCopy.scopeHint}</p>
            </fieldset>
          ) : null}

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
              {convocationsCopy.cancel}
            </button>
            <button
              type="submit"
              className={dialogStyles.button}
              disabled={saving || rows.length === 0}
            >
              {saving ? convocationsCopy.saving : convocationsCopy.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
