"use client";

import { useEffect, useMemo, useState } from "react";
import { WhiteboardSvg } from "@/components/training/WhiteboardSvg";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import {
  SegmentedChoice,
  type SegmentedOption,
} from "@/components/ui/SegmentedChoice";
import type { ClubEventView } from "@/lib/firebase/eventService";
import {
  loadLibrarySessions,
  type LibrarySession,
} from "@/lib/firebase/trainingService";
import {
  drillDisplayTitle,
  plannedMinutes,
  searchKey,
  type TrainingDrill,
} from "@/lib/training/trainingPlan";
import { isBoardEmpty } from "@/lib/training/whiteboard";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import styles from "./LibraryPanel.module.css";

type LibraryTab = "sessions" | "drills";

const TABS: ReadonlyArray<SegmentedOption<LibraryTab>> = [
  { value: "sessions", label: "Séances" },
  { value: "drills", label: "Exercices" },
];

type LibraryPanelProps = {
  clubId: string;
  /** Entraînements passés de mes équipes (hors séance en cours). */
  events: ClubEventView[];
  onClose: () => void;
  /**
   * Ajoute des exercices (copiés) et, pour une séance, ses notes. Absent :
   * consultation seule (aucune séance ouverte).
   */
  onAddDrills?: (drills: TrainingDrill[], notes?: string) => void;
  /** Ouvre une séance passée pour la consulter. */
  onOpenSession: (eventId: string) => void;
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Bibliothèque (panneau latéral) : séances passées préparées par moi ou mes
 * collègues sur mes équipes, à consulter, à dupliquer en entier, ou leurs
 * exercices à ajouter un par un (recherche sur le titre et les consignes).
 */
export function LibraryPanel({
  clubId,
  events,
  onClose,
  onAddDrills,
  onOpenSession,
}: LibraryPanelProps) {
  const panelRef = useDialogA11y({ onClose, modal: false });
  const [sessions, setSessions] = useState<LibrarySession[] | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<LibraryTab>("sessions");
  const [search, setSearch] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void loadLibrarySessions({ clubId, events })
      .then((result) => {
        if (!cancelled) setSessions(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
    // Chargée une fois à l’ouverture du panneau.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needle = searchKey(search);
  const filteredSessions = useMemo(
    () =>
      (sessions ?? []).filter(
        (session) =>
          !needle ||
          searchKey(
            [
              session.event.title,
              session.notes,
              session.coachName,
              ...session.drills.map((drill) => drill.title),
            ].join(" "),
          ).includes(needle),
      ),
    [sessions, needle],
  );

  const drills = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{ key: string; drill: TrainingDrill; session: LibrarySession }> = [];
    for (const session of sessions ?? []) {
      for (const drill of session.drills) {
        // Même exercice réutilisé d’une séance à l’autre : une seule ligne.
        const hasText = Boolean(drill.title.trim() || drill.instructions.trim());
        if (!hasText && drill.boards.length === 0) continue;
        // Schéma seul : unique par exercice (rien à comparer).
        const signature = hasText
          ? searchKey(`${drill.title}|${drill.instructions}`)
          : `board:${session.event.id}:${drill.id}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        rows.push({ key: `${session.event.id}:${session.coachUid}:${drill.id}`, drill, session });
      }
    }
    return rows.filter(
      (row) =>
        !needle ||
        searchKey(`${row.drill.title} ${row.drill.instructions}`).includes(needle),
    );
  }, [sessions, needle]);

  function markAdded(key: string) {
    setAdded((current) => new Set(current).add(key));
  }

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby="training-library-title"
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Séances passées de tes équipes</p>
          <h2 id="training-library-title" className={styles.title}>
            Bibliothèque
          </h2>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Fermer la bibliothèque"
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </button>
      </header>

      <div className={styles.controls}>
        <SegmentedChoice
          options={TABS}
          value={tab}
          onSelect={setTab}
          ariaLabel="Contenu de la bibliothèque"
          size="sm"
        />
        <label className={styles.search}>
          <span className="sr-only">Rechercher</span>
          <input
            type="search"
            value={search}
            placeholder="Rechercher un exercice, une séance…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <div className={styles.body}>
        {error ? (
          <p className={styles.error} role="alert">
            Impossible de charger la bibliothèque.
          </p>
        ) : sessions === null ? (
          <p className={styles.muted} aria-live="polite">
            Chargement des séances passées…
          </p>
        ) : tab === "sessions" ? (
          filteredSessions.length === 0 ? (
            <p className={styles.muted}>
              Aucune séance préparée{needle ? " ne correspond" : " pour l’instant"}.
            </p>
          ) : (
            <ul className={styles.list}>
              {filteredSessions.map((session) => {
                const key = `${session.event.id}:${session.coachUid}`;
                return (
                  <li key={key} className={styles.item}>
                    <p className={styles.itemTitle}>
                      {formatDay(session.event.startsAt)} ·{" "}
                      {session.event.teamLabels.join(", ") || "Entraînement"}
                    </p>
                    <p className={styles.itemMeta}>
                      {session.coachName || "Coach"} · {session.drills.length}{" "}
                      exercice{session.drills.length > 1 ? "s" : ""}
                      {plannedMinutes(session.drills) > 0
                        ? ` · ${plannedMinutes(session.drills)} min`
                        : ""}
                    </p>
                    {session.drills.length > 0 ? (
                      <p className={styles.itemDrills}>
                        {session.drills
                          .map((drill, index) => drillDisplayTitle(drill, index + 1))
                          .join(" → ")}
                      </p>
                    ) : null}
                    <div className={styles.itemActions}>
                      <Button
                        size="sm"
                        variant={onAddDrills ? "ghost" : "secondary"}
                        onClick={() => onOpenSession(session.event.id)}
                      >
                        Consulter
                      </Button>
                      {onAddDrills ? (
                        <Button
                          size="sm"
                          disabled={added.has(key)}
                          onClick={() => {
                            onAddDrills(session.drills, session.notes);
                            markAdded(key);
                          }}
                        >
                          {added.has(key) ? "Dupliquée" : "Dupliquer dans cette séance"}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : drills.length === 0 ? (
          <p className={styles.muted}>
            Aucun exercice{needle ? " ne correspond" : " pour l’instant"}.
          </p>
        ) : (
          <ul className={styles.list}>
            {drills.map(({ key, drill, session }) => {
              const preview = drill.boards.find((board) => !isBoardEmpty(board));
              return (
                <li key={key} className={styles.item} data-with-preview={preview ? "true" : undefined}>
                  {preview ? (
                    <div className={styles.preview}>
                      <WhiteboardSvg board={preview} label={`Schéma de ${drill.title || "l’exercice"}`} />
                    </div>
                  ) : null}
                  <div className={styles.itemText}>
                    <p className={styles.itemTitle}>
                      {drill.title.trim() || "Exercice"}
                      {drill.durationMin ? ` · ${drill.durationMin} min` : ""}
                    </p>
                    {drill.instructions.trim() ? (
                      <p className={styles.itemDrills}>{drill.instructions.trim()}</p>
                    ) : null}
                    <p className={styles.itemMeta}>
                      {formatDay(session.event.startsAt)} · {session.coachName || "Coach"}
                    </p>
                    {onAddDrills ? (
                      <Button
                        size="sm"
                        disabled={added.has(key)}
                        onClick={() => {
                          onAddDrills([drill]);
                          markAdded(key);
                        }}
                      >
                        {added.has(key) ? "Ajouté" : "Ajouter à la séance"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onOpenSession(session.event.id)}
                      >
                        Consulter la séance
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
