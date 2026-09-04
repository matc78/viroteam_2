"use client";

import { useEffect, useMemo, useState } from "react";
import { setEventRsvp } from "@/lib/firebase/callableService";
import type { ClubEventView } from "@/lib/firebase/eventService";
import styles from "./FamilyRsvpButtons.module.css";

type FamilyRsvpButtonsProps = {
  clubId: string;
  event: ClubEventView;
  memberId: string;
  /**
   * Identifiants alternatifs (uid, memberId, etc.) pour lire / détecter
   * la convocation quand `teamMemberIds` / `rsvp` mélangent les clés.
   */
  audienceIds?: string[];
  onUpdated?: (value: "yes" | "maybe" | "no") => void;
  /** `footer` : barre style popover « Tu viens ? ». */
  variant?: "default" | "footer";
};

const OPTIONS: Array<{ value: "yes" | "maybe" | "no"; label: string }> = [
  { value: "yes", label: "Oui" },
  { value: "maybe", label: "Peut-être" },
  { value: "no", label: "Non" },
];

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

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localValue, setLocalValue] = useState(current);

  useEffect(() => {
    setLocalValue(current);
  }, [current]);

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
