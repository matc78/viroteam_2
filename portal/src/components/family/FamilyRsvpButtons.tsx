"use client";

import { useState } from "react";
import { setEventRsvp } from "@/lib/firebase/callableService";
import type { ClubEventView } from "@/lib/firebase/eventService";
import styles from "./FamilyRsvpButtons.module.css";

type FamilyRsvpButtonsProps = {
  clubId: string;
  event: ClubEventView;
  memberId: string;
  onUpdated?: (value: "yes" | "maybe" | "no") => void;
};

const OPTIONS: Array<{ value: "yes" | "maybe" | "no"; label: string }> = [
  { value: "yes", label: "Oui" },
  { value: "maybe", label: "Peut-être" },
  { value: "no", label: "Non" },
];

/** Boutons RSVP Oui / Peut-être / Non pour la fiche cible. */
export function FamilyRsvpButtons({
  clubId,
  event,
  memberId,
  onUpdated,
}: FamilyRsvpButtonsProps) {
  const current = event.rsvpByMemberId[memberId] ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localValue, setLocalValue] = useState(current);

  async function handleSelect(value: "yes" | "maybe" | "no") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await setEventRsvp({
        clubId,
        eventId: event.id,
        memberId,
        value,
      });
      setLocalValue(value);
      onUpdated?.(value);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Impossible d’enregistrer la réponse.",
      );
    } finally {
      setBusy(false);
    }
  }

  const invited =
    event.teamMemberIds.length === 0 || event.teamMemberIds.includes(memberId);
  if (!invited) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.row} role="group" aria-label="Réponse à la convocation">
        {OPTIONS.map((option) => {
          const selected = localValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`${styles.button}${selected ? ` ${styles.buttonActive}` : ""}`}
              data-value={option.value}
              disabled={busy}
              onClick={() => void handleSelect(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
