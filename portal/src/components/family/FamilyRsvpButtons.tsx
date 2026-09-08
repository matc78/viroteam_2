"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { setEventRsvp } from "@/lib/firebase/callableService";
import type { ClubEventView } from "@/lib/firebase/eventService";
import styles from "./FamilyRsvpButtons.module.css";

type RsvpValue = "yes" | "maybe" | "no";

type FamilyRsvpButtonsProps = {
  clubId: string;
  event: ClubEventView;
  memberId: string;
  /**
   * Identifiants alternatifs (uid, memberId, etc.) pour lire / détecter
   * la convocation quand `teamMemberIds` / `rsvp` mélangent les clés.
   */
  audienceIds?: string[];
  /** Mise à jour locale immédiate (sans reload parent). */
  onOptimisticChange?: (value: RsvpValue | null) => void;
  /** Appelé une fois après persistance réussie (resync parent). */
  onUpdated?: (value: RsvpValue) => void;
  /** `footer` : barre style popover « Tu viens ? ». */
  variant?: "default" | "footer";
};

const OPTIONS: Array<{ value: RsvpValue; label: string }> = [
  { value: "yes", label: "Oui" },
  { value: "maybe", label: "Peut-être" },
  { value: "no", label: "Non" },
];

function isRsvpValue(value: string): value is RsvpValue {
  return value === "yes" || value === "maybe" || value === "no";
}

/** Normalise la liste d’IDs audience (memberId + aliases). */
function resolveAudienceAliases(
  memberId: string,
  audienceIds?: string[],
): string[] {
  const ids = new Set<string>();
  for (const value of [memberId, ...(audienceIds ?? [])]) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) ids.add(trimmed);
  }
  return [...ids];
}

/** Boutons RSVP Oui / Peut-être / Non pour la fiche cible. */
export function FamilyRsvpButtons({
  clubId,
  event,
  memberId,
  audienceIds,
  onOptimisticChange,
  onUpdated,
  variant = "default",
}: FamilyRsvpButtonsProps) {
  const aliases = useMemo(
    () => resolveAudienceAliases(memberId, audienceIds),
    [memberId, audienceIds],
  );

  const current = useMemo(() => {
    for (const id of aliases) {
      const value = event.rsvpByMemberId[id];
      if (value) return value;
    }
    return "";
  }, [aliases, event.rsvpByMemberId]);

  const [error, setError] = useState<string | null>(null);
  const [localValue, setLocalValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setLocalValue(current);
  }, [current]);

  async function handleSelect(value: RsvpValue) {
    if (localValue === value || inFlightRef.current) return;

    const previous = localValue;
    inFlightRef.current = true;
    setBusy(true);
    setLocalValue(value);
    setError(null);
    onOptimisticChange?.(value);

    try {
      await setEventRsvp({
        clubId,
        eventId: event.id,
        memberId,
        value,
      });
      onUpdated?.(value);
    } catch (err: unknown) {
      setLocalValue(previous);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’enregistrer la réponse.",
      );
      onOptimisticChange?.(isRsvpValue(previous) ? previous : null);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  const invited =
    event.teamMemberIds.length === 0 ||
    event.teamMemberIds.some((id) => aliases.includes(id));
  if (!invited) return null;

  return (
    <div
      className={styles.wrap}
      data-variant={variant}
    >
      {variant === "footer" ? (
        <span className={styles.prompt}>Tu viens ?</span>
      ) : null}
      <div className={styles.row} role="group" aria-label="Réponse à la convocation" aria-busy={busy}>
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
