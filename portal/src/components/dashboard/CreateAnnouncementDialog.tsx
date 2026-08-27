"use client";

import { FormEvent, useMemo, useState } from "react";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import { PlanningGuestPicker } from "@/components/dashboard/PlanningGuestPicker";
import type {
  PlanningPersonOption,
  TeamOption,
} from "@/lib/firebase/eventService";
import type { PlanningGuestSelection } from "@/lib/planning/resolveGuestAudience";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import styles from "./CreateAnnouncementDialog.module.css";

/** Valeurs soumises par le formulaire nouvelle annonce. */
export type CreateAnnouncementFormValues = {
  message: string;
  allClub: boolean;
  guests: PlanningGuestSelection[];
  endsAt: Date;
};

type CreateAnnouncementDialogProps = {
  teams: TeamOption[];
  categories: string[];
  people: PlanningPersonOption[];
  busy: boolean;
  error: string | null;
  /** Autorise « Tout le club » (admin). Défaut true. */
  allowAllClub?: boolean;
  /** Kinds autorisés dans le picker (coach : équipes seulement). */
  allowedKinds?: Array<"team" | "category" | "person">;
  onClose: () => void;
  onSubmit: (values: CreateAnnouncementFormValues) => Promise<void>;
};

function defaultEndsAtLocalValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setMinutes(0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Dialog création d’annonce club (message, cibles, date limite). */
export function CreateAnnouncementDialog({
  teams,
  categories,
  people,
  busy,
  error,
  allowAllClub = true,
  allowedKinds: allowedKindsProp,
  onClose,
  onSubmit,
}: CreateAnnouncementDialogProps) {
  const [message, setMessage] = useState("");
  const [allClub, setAllClub] = useState(allowAllClub);
  const [guests, setGuests] = useState<PlanningGuestSelection[]>([]);
  const [endsAtLocal, setEndsAtLocal] = useState(defaultEndsAtLocalValue);

  const allowedKinds = useMemo((): Array<"team" | "category" | "person"> => {
    return allowedKindsProp ?? ["team", "category", "person"];
  }, [allowedKindsProp]);

  function requestClose() {
    if (busy) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const endsAt = new Date(endsAtLocal);
    await onSubmit({
      message: message.trim(),
      allClub,
      guests: allClub ? [] : guests,
      endsAt,
    });
  }

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
        aria-labelledby="create-announcement-title"
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>Annonces</p>
            <h2 id="create-announcement-title" className={dialogStyles.title}>
              Nouvelle annonce
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
          onSubmit={(formEvent) => void handleSubmit(formEvent)}
        >
          <label className={dialogStyles.field}>
            <span className={dialogStyles.label}>Message</span>
            <textarea
              className={styles.textarea}
              value={message}
              onChange={(changeEvent) => setMessage(changeEvent.target.value)}
              required
              disabled={busy}
              rows={5}
              placeholder="Ex. : entraînement annulé demain…"
            />
          </label>

          {allowAllClub ? (
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={allClub}
                disabled={busy}
                onChange={(changeEvent) => {
                  setAllClub(changeEvent.target.checked);
                  if (changeEvent.target.checked) setGuests([]);
                }}
              />
              <span className={styles.toggleLabel}>
                Tout le club
                <span className={styles.toggleHint}>
                  Sinon, ciblez des équipes, catégories ou personnes.
                </span>
              </span>
            </label>
          ) : null}

          {!allClub ? (
            <div className={dialogStyles.field}>
              <span className={dialogStyles.label}>Destinataires</span>
              <PlanningGuestPicker
                id="announcement-guests"
                teams={teams}
                categories={categories}
                people={people}
                allowedKinds={[...allowedKinds]}
                value={guests}
                disabled={busy}
                placeholder={
                  allowedKinds.length === 1 && allowedKinds[0] === "team"
                    ? "Ajouter des équipes…"
                    : "Ajouter équipes, catégories, personnes…"
                }
                onChange={setGuests}
              />
            </div>
          ) : null}

          <label className={dialogStyles.field}>
            <span className={dialogStyles.label}>Date limite</span>
            <input
              className={styles.input}
              type="datetime-local"
              value={endsAtLocal}
              onChange={(changeEvent) => setEndsAtLocal(changeEvent.target.value)}
              required
              disabled={busy}
            />
          </label>

          <p className={styles.hint}>
            L’annonce disparaît pour les destinataires après cette date, sauf
            si vous la clôturez avant ou retirez la date limite.
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
              disabled={busy || (!allClub && guests.length === 0)}
            >
              {busy ? "Publication…" : "Publier"}
            </button>
          </div>
        </form>
      </FadeScrollArea>
    </div>
  );
}
