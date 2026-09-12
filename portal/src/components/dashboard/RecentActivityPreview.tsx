"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
import panelStyles from "./DashboardPanel.module.css";
import styles from "./RecentActivityPreview.module.css";

type RecentActivityPreviewProps = {
  clubId: string;
};

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
 * Aperçu home : dernière action club + lien vers le journal.
 */
export function RecentActivityPreview({ clubId }: RecentActivityPreviewProps) {
  const [event, setEvent] = useState<ClubActivityEventRecord | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listClubActivity(clubId, 1)
      .then((rows) => {
        setEvent(rows[0] ?? null);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger l’activité.",
        );
        setEvent(null);
      });
  }, [clubId]);

  useEffect(() => {
    setEvent(undefined);
    load();
  }, [load]);

  useClubRealtimeReload({
    clubId,
    collections: ClubListenSets.activity,
    onReload: load,
    enabled: Boolean(clubId),
  });

  const detail = event ? clubActivityDetail(event) : null;

  return (
    <section
      className={panelStyles.panel}
      data-tone="orange"
      aria-labelledby="recent-activity-title"
    >
      <header className={styles.header}>
        <div>
          <h2 id="recent-activity-title" className={styles.title}>
            Dernières actions
          </h2>
          <p className={styles.subtitle}>Ce qui vient d’être fait dans le club</p>
        </div>
        <Link href="/activity" className={styles.viewAllLink}>
          Voir tout →
        </Link>
      </header>

      {error ? (
        <p className={styles.muted} role="alert">
          {error}
        </p>
      ) : null}

      {event === undefined && !error ? (
        <p className={styles.muted}>Chargement…</p>
      ) : null}

      {event === null && !error ? (
        <p className={styles.muted}>
          Rien pour l’instant — les prochaines actions apparaîtront ici.
        </p>
      ) : null}

      {event ? (
        <div className={styles.preview}>
          <p className={styles.previewTitle}>{clubActivityTitle(event)}</p>
          {detail ? <p className={styles.previewDetail}>{detail}</p> : null}
          <p className={styles.previewMeta}>
            {actorLabel(event.actorDisplayName)}
            {event.createdAt
              ? ` · ${formatEventDate(event.createdAt)}`
              : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}
