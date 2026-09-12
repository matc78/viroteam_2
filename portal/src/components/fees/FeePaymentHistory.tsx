"use client";

import { useEffect, useState } from "react";
import {
  feePaymentEventDetail,
  feePaymentEventTitle,
  listPaymentEvents,
  type FeePaymentEventRecord,
} from "@/lib/firebase/feeService";
import styles from "./FeePaymentHistory.module.css";

type FeePaymentHistoryProps = {
  clubId: string;
  seasonId: string;
  memberId: string;
  /** Compacte pour dialog / fiche famille. */
  compact?: boolean;
};

function formatEventDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Liste chronologique des transactions cotisation (ledger `payment_events`).
 */
export function FeePaymentHistory({
  clubId,
  seasonId,
  memberId,
  compact = false,
}: FeePaymentHistoryProps) {
  const [events, setEvents] = useState<FeePaymentEventRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError(null);
    listPaymentEvents({ clubId, seasonId, memberId })
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger l’historique.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clubId, seasonId, memberId]);

  return (
    <section
      className={`${styles.section} ${compact ? styles.compact : ""}`}
      aria-label="Historique des paiements"
    >
      <h3 className={styles.title}>Historique des paiements</h3>
      {error ? <p className={styles.error}>{error}</p> : null}
      {!error && events === null ? (
        <p className={styles.muted}>Chargement…</p>
      ) : null}
      {!error && events && events.length === 0 ? (
        <p className={styles.muted}>Aucune transaction pour l’instant.</p>
      ) : null}
      {!error && events && events.length > 0 ? (
        <ul className={styles.list}>
          {events.map((event) => {
            const detail = feePaymentEventDetail(event);
            return (
              <li key={event.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.itemTitle}>
                    {feePaymentEventTitle(event.type)}
                  </span>
                  <time className={styles.itemDate} dateTime={event.createdAt?.toISOString()}>
                    {formatEventDate(event.createdAt)}
                  </time>
                </div>
                {detail ? <p className={styles.itemDetail}>{detail}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
