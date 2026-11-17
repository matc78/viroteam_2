"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TextLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow, ListRows } from "@/components/ui/ListRow";
import {
  ClubListenSets,
  useClubRealtimeReload,
} from "@/lib/dashboard/useClubRealtimeReload";
import {
  clubActivityDetail,
  clubActivityTitle,
  listClubActivity,
  type ClubActivityEventRecord,
} from "@/lib/firebase/activityService";
import styles from "./RecentActivityPreview.module.css";

type RecentActivityPreviewProps = {
  clubId: string;
};

/** Nombre d’actions affichées sur l’accueil. */
const PREVIEW_LIMIT = 3;

function formatEventDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function actorLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Staff";
  return trimmed;
}

/**
 * Aperçu home : dernières actions du club + lien vers le journal.
 */
export function RecentActivityPreview({ clubId }: RecentActivityPreviewProps) {
  const [events, setEvents] = useState<ClubActivityEventRecord[] | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  /** Numéro de la dernière requête : une réponse plus ancienne est ignorée. */
  const requestIdRef = useRef(0);

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setError(null);
    listClubActivity(clubId, PREVIEW_LIMIT)
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setEvents(result);
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger l’activité.",
        );
        setEvents([]);
      });
  }, [clubId]);

  useEffect(() => {
    setEvents(undefined);
    load();
  }, [load]);

  useClubRealtimeReload({
    clubId,
    collections: ClubListenSets.activity,
    onReload: load,
    enabled: Boolean(clubId),
  });

  return (
    <Card padding="none" aria-labelledby="recent-activity-title">
      <CardHeader
        title="Dernières actions"
        titleId="recent-activity-title"
        action={<TextLink href="/activity">Journal</TextLink>}
      />

      {error ? (
        <p className={styles.message} role="alert">
          {error}
        </p>
      ) : events === undefined ? (
        <p className={styles.message}>Chargement…</p>
      ) : events.length === 0 ? (
        <div className={styles.message}>
          <EmptyState>Rien pour l’instant.</EmptyState>
        </div>
      ) : (
        <ListRows aria-label="Dernières actions">
          {events.map((event) => {
            const detail = clubActivityDetail(event);
            return (
              <ListRow
                key={event.id}
                title={clubActivityTitle(event)}
                meta={[
                  detail,
                  actorLabel(event.actorDisplayName),
                  event.createdAt ? formatEventDate(event.createdAt) : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            );
          })}
        </ListRows>
      )}
    </Card>
  );
}
