"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClubEventView } from "@/lib/firebase/eventService";
import { eventHasRsvp, withLocalRsvp, type RsvpValue } from "./localRsvp";

type RsvpOverride = { memberIds: string[]; value: RsvpValue };

/** Signature du setter d'override (null = annule l'override de l'événement). */
export type SetRsvpOverride = (
  eventId: string,
  memberIds: string[],
  value: RsvpValue | null,
) => void;

/**
 * Optimistic UI RSVP au niveau de la page : applique les réponses locales
 * sur les événements chargés (calendrier + popover changent au clic), puis
 * retire chaque override dès que les données rechargées portent la valeur.
 */
export function useOptimisticEventRsvp<T extends ClubEventView>(
  sourceEvents: T[],
): {
  events: T[];
  setRsvpOverride: SetRsvpOverride;
} {
  const [overrides, setOverrides] = useState<Record<string, RsvpOverride>>({});

  const setRsvpOverride = useCallback<SetRsvpOverride>(
    (eventId, memberIds, value) => {
      setOverrides((current) => {
        const next = { ...current };
        if (value) next[eventId] = { memberIds, value };
        else delete next[eventId];
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const confirmedIds = sourceEvents
      .filter((event) => {
        const override = overrides[event.id];
        return override
          ? eventHasRsvp(event, override.memberIds, override.value)
          : false;
      })
      .map((event) => event.id);
    if (confirmedIds.length === 0) return;
    setOverrides((current) => {
      const next = { ...current };
      for (const id of confirmedIds) delete next[id];
      return next;
    });
  }, [sourceEvents, overrides]);

  const events = useMemo(() => {
    if (Object.keys(overrides).length === 0) return sourceEvents;
    return sourceEvents.map((event) => {
      const override = overrides[event.id];
      return override
        ? withLocalRsvp(event, override.memberIds, override.value)
        : event;
    });
  }, [sourceEvents, overrides]);

  return { events, setRsvpOverride };
}
