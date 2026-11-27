"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DrillEditor } from "@/components/training/DrillEditor";
import { LibraryPanel } from "@/components/training/LibraryPanel";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ClubEventView } from "@/lib/firebase/eventService";
import {
  deleteMyDrill,
  loadSessionPlans,
  newDrillId,
  saveMyDrill,
  saveMyPlan,
  type CoachPlan,
} from "@/lib/firebase/trainingService";
import {
  copyDrill,
  drillDisplayTitle,
  moveItem,
  plannedMinutes,
  sessionMinutes,
  type TrainingDrill,
} from "@/lib/training/trainingPlan";
import styles from "./SessionEditor.module.css";

/** Délai d’enregistrement automatique après la dernière frappe (ms). */
const AUTOSAVE_DELAY_MS = 900;

type SaveState = "idle" | "saving" | "saved" | "error";

type SessionEditorProps = {
  clubId: string;
  event: ClubEventView;
  coachUid: string;
  coachName: string;
  /** Séance déjà terminée (ouverte depuis la bibliothèque). */
  isPast: boolean;
  /** Entraînements passés de mes équipes (bibliothèque). */
  libraryEvents: ClubEventView[];
  /** Ouvre une séance passée de la bibliothèque. */
  onOpenSession: (eventId: string) => void;
  /** Retour aux prochaines séances (séance passée affichée). */
  onBackToUpcoming?: () => void;
};

function formatSessionDate(event: ClubEventView): string {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const day = start.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = (date: Date) =>
    date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const label = `${day} · ${time(start)} – ${time(end)}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Intitulé de l’entraînement s’il apporte autre chose que l’équipe. */
function distinctTitle(event: ClubEventView): string | null {
  const title = event.title.trim();
  if (!title) return null;
  const key = title.toLocaleLowerCase("fr-FR");
  if (key === "entraînement" || key === "entrainement") return null;
  if (event.teamLabels.some((label) => label.toLocaleLowerCase("fr-FR") === key)) {
    return null;
  }
  return title;
}

/**
 * Préparation d’une séance : ma partie (notes, exercices ordonnés,
 * minutage, schémas) enregistrée au fil de l’eau, préparations des
 * collègues en lecture seule, bibliothèque des séances passées.
 */
export function SessionEditor({
  clubId,
  event,
  coachUid,
  coachName,
  isPast,
  libraryEvents,
  onOpenSession,
  onBackToUpcoming,
}: SessionEditorProps) {
  const [plans, setPlans] = useState<CoachPlan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [drills, setDrills] = useState<TrainingDrill[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewCoach, setViewCoach] = useState<string>(coachUid);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingSaves = useRef(new Map<string, () => Promise<void>>());
  const inFlight = useRef(0);
  /** Enregistrements en échec (par clé), relancés à la prochaine modif. */
  const failedSaves = useRef(new Map<string, () => Promise<void>>());
  const [reloadToken, setReloadToken] = useState(0);

  const ids = { clubId, eventId: event.id, coachUid };

  const runSave = useCallback(
    async (key: string, task: () => Promise<void>) => {
      inFlight.current += 1;
      setSaveState("saving");
      try {
        await task();
        failedSaves.current.delete(key);
      } catch {
        // Gardé pour être relancé : un succès ailleurs ne doit pas le masquer.
        failedSaves.current.set(key, task);
      }
      inFlight.current -= 1;
      if (inFlight.current === 0) {
        setSaveState(failedSaves.current.size > 0 ? "error" : "saved");
      }
    },
    [],
  );

  /** Programme l’enregistrement [key] (remplace le précédent du même key). */
  const schedule = useCallback(
    (key: string, task: () => Promise<void>) => {
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      pendingSaves.current.set(key, task);
      setSaveState("saving");
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          pendingSaves.current.delete(key);
          // Les échecs précédents repartent avec cet enregistrement.
          for (const [failedKey, failed] of failedSaves.current) {
            if (failedKey !== key) void runSave(failedKey, failed);
          }
          void runSave(key, task);
        }, AUTOSAVE_DELAY_MS),
      );
    },
    [runSave],
  );

  // Chargement des préparations ; à la sortie, enregistre ce qui attend.
  useEffect(() => {
    let cancelled = false;
    const pendingTimers = timers.current;
    const pending = pendingSaves.current;
    setPlans(null);
    setLoadError(null);
    setViewCoach(coachUid);
    setSaveState("idle");
    failedSaves.current.clear();
    void loadSessionPlans(clubId, event.id)
      .then((loaded) => {
        if (cancelled) return;
        setPlans(loaded);
        const mine = loaded.find((item) => item.plan.coachUid === coachUid);
        setNotes(mine?.plan.notes ?? "");
        setDrills(mine?.drills ?? []);
        setSelectedId(mine?.drills[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Impossible de charger la préparation.");
      });
    return () => {
      cancelled = true;
      for (const timer of pendingTimers.values()) clearTimeout(timer);
      pendingTimers.clear();
      for (const task of pending.values()) void task().catch(() => undefined);
      pending.clear();
    };
  }, [clubId, event.id, coachUid, reloadToken]);

  // Onglet fermé ou rechargé pendant l’attente : on enregistre tout de suite
  // et le navigateur prévient tant qu’un enregistrement est en cours.
  useEffect(() => {
    const flush = () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
      for (const [key, task] of pendingSaves.current) void runSave(key, task);
      pendingSaves.current.clear();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onBeforeUnload = (unloadEvent: BeforeUnloadEvent) => {
      if (pendingSaves.current.size === 0 && inFlight.current === 0) return;
      flush();
      unloadEvent.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [runSave]);

  function savePlan(patch: { notes?: string; drillOrder?: string[] }) {
    return saveMyPlan({
      ...ids,
      coachName,
      teamIds: event.teamIds,
      ...patch,
    });
  }

  function changeNotes(value: string) {
    setNotes(value);
    schedule("plan:notes", () => savePlan({ notes: value }));
  }

  function changeDrill(next: TrainingDrill) {
    setDrills((current) =>
      current.map((drill) => (drill.id === next.id ? next : drill)),
    );
    schedule(`drill:${next.id}`, () => saveMyDrill({ ...ids, drill: next }));
  }

  function reorder(from: number, to: number) {
    const next = moveItem(drills, from, to);
    setDrills(next);
    void runSave("order", () =>
      savePlan({ drillOrder: next.map((drill) => drill.id) }),
    );
  }

  function addDrills(toAdd: TrainingDrill[], importedNotes?: string) {
    if (toAdd.length === 0 && !importedNotes) return;
    const copies = toAdd.map((drill) =>
      copyDrill(drill, newDrillId(clubId, event.id, coachUid)),
    );
    const next = [...drills, ...copies];
    const nextNotes =
      importedNotes && !notes.trim() ? importedNotes : undefined;
    setDrills(next);
    if (nextNotes !== undefined) setNotes(nextNotes);
    if (copies[0]) setSelectedId(copies[0].id);
    setViewCoach(coachUid);
    void runSave(`add:${copies[0]?.id ?? "notes"}`, async () => {
      await Promise.all(copies.map((drill) => saveMyDrill({ ...ids, drill })));
      await savePlan({
        drillOrder: next.map((drill) => drill.id),
        ...(nextNotes !== undefined ? { notes: nextNotes } : {}),
      });
    });
  }

  function addBlankDrill() {
    addDrills([
      {
        id: "",
        title: "",
        durationMin: null,
        instructions: "",
        boards: [],
      },
    ]);
  }

  function removeDrill(drillId: string) {
    const timer = timers.current.get(`drill:${drillId}`);
    if (timer) clearTimeout(timer);
    timers.current.delete(`drill:${drillId}`);
    pendingSaves.current.delete(`drill:${drillId}`);
    failedSaves.current.delete(`drill:${drillId}`);
    const next = drills.filter((drill) => drill.id !== drillId);
    setDrills(next);
    setConfirmDelete(null);
    if (selectedId === drillId) setSelectedId(next[0]?.id ?? null);
    void runSave(`remove:${drillId}`, async () => {
      await deleteMyDrill({ ...ids, drillId });
      await savePlan({ drillOrder: next.map((drill) => drill.id) });
    });
  }

  const colleagues = (plans ?? []).filter(
    (item) =>
      item.plan.coachUid !== coachUid &&
      (item.drills.length > 0 || item.plan.notes.trim()),
  );
  const viewing = viewCoach === coachUid
    ? null
    : colleagues.find((item) => item.plan.coachUid === viewCoach) ?? null;
  const shownDrills = viewing ? viewing.drills : drills;
  const shownNotes = viewing ? viewing.plan.notes : notes;
  const selected =
    shownDrills.find((drill) => drill.id === selectedId) ?? shownDrills[0] ?? null;

  const planned = plannedMinutes(shownDrills);
  const available = sessionMinutes(event.startsAt, event.endsAt);
  const overtime = available !== null && planned > available;

  const subtitle = distinctTitle(event);
  const selectedPosition = selected ? shownDrills.indexOf(selected) + 1 : 0;

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>{formatSessionDate(event)}</p>
          <h2 className={styles.title}>
            {event.teamLabels.join(", ")}
            {subtitle ? <span className={styles.subtitle}> · {subtitle}</span> : null}
            {isPast ? <StatusBadge tone="neutral">Séance passée</StatusBadge> : null}
          </h2>
          {event.location ? <p className={styles.meta}>{event.location}</p> : null}
        </div>
        <div className={styles.headerActions}>
          <SaveIndicator state={saveState} />
          {onBackToUpcoming ? (
            <Button size="sm" variant="ghost" onClick={onBackToUpcoming}>
              Prochaines séances
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setLibraryOpen(true)}>
            Bibliothèque
          </Button>
        </div>
      </header>

      {loadError ? (
        // Jamais d’éditeur vide après un échec : il écraserait la préparation.
        <div className={styles.error} role="alert">
          <p>{loadError}</p>
          <Button size="sm" onClick={() => setReloadToken((token) => token + 1)}>
            Réessayer
          </Button>
        </div>
      ) : null}

      {colleagues.length > 0 ? (
        <div className={styles.coachTabs} role="tablist" aria-label="Préparations">
          <button
            type="button"
            role="tab"
            aria-selected={viewing === null}
            className={styles.coachTab}
            onClick={() => setViewCoach(coachUid)}
          >
            Ma préparation
          </button>
          {colleagues.map((item) => (
            <button
              key={item.plan.coachUid}
              type="button"
              role="tab"
              aria-selected={viewCoach === item.plan.coachUid}
              className={styles.coachTab}
              onClick={() => {
                setViewCoach(item.plan.coachUid);
                setSelectedId(item.drills[0]?.id ?? null);
              }}
            >
              {item.plan.coachName || "Collègue"}
            </button>
          ))}
        </div>
      ) : null}

      {loadError ? null : plans === null ? (
        <p className={styles.muted} aria-live="polite">
          Chargement de la préparation…
        </p>
      ) : (
        <div className={styles.layout}>
          <aside className={styles.side}>
            <div className={styles.timing} data-overtime={overtime ? "true" : undefined}>
              <span>
                <strong>{planned} min</strong>
                {available !== null ? ` / ${available} min` : " prévues"}
              </span>
              {overtime ? (
                <StatusBadge tone="warning">
                  +{planned - available!} min
                </StatusBadge>
              ) : null}
            </div>

            <ol className={styles.drillList} aria-label="Exercices">
              {shownDrills.map((drill, index) => (
                <li
                  key={drill.id}
                  className={styles.drillRow}
                  data-selected={selected?.id === drill.id ? "true" : undefined}
                  data-dragging={dragIndex === index ? "true" : undefined}
                  draggable={viewing === null}
                  onDragStart={(dragEvent) => {
                    // Firefox ne démarre pas de glisser sans donnée.
                    dragEvent.dataTransfer.setData("text/plain", drill.id);
                    dragEvent.dataTransfer.effectAllowed = "move";
                    setDragIndex(index);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  onDragOver={(dragEvent) => {
                    if (dragIndex !== null) dragEvent.preventDefault();
                  }}
                  onDrop={(dropEvent) => {
                    dropEvent.preventDefault();
                    if (dragIndex !== null) reorder(dragIndex, index);
                    setDragIndex(null);
                  }}
                >
                  <button
                    type="button"
                    className={styles.drillButton}
                    aria-current={selected?.id === drill.id ? "true" : undefined}
                    onClick={() => {
                      setSelectedId(drill.id);
                      setConfirmDelete(null);
                    }}
                  >
                    <span className={styles.drillIndex}>{index + 1}</span>
                    <span className={styles.drillName}>
                      {drillDisplayTitle(drill, index + 1)}
                    </span>
                    {drill.durationMin ? (
                      <span className={styles.drillDuration}>
                        {drill.durationMin}′
                      </span>
                    ) : null}
                  </button>
                  {viewing === null ? (
                    <span className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Monter l’exercice ${index + 1}`}
                        title="Monter"
                        disabled={index === 0}
                        onClick={() => reorder(index, index - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Descendre l’exercice ${index + 1}`}
                        title="Descendre"
                        disabled={index === shownDrills.length - 1}
                        onClick={() => reorder(index, index + 1)}
                      >
                        ↓
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>

            {viewing === null ? (
              <Button size="sm" onClick={addBlankDrill}>
                <Icon name="plus" size={16} />
                Ajouter un exercice
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => addDrills(viewing.drills)}
                disabled={viewing.drills.length === 0}
              >
                Copier dans ma préparation
              </Button>
            )}

            <label className={styles.notesField}>
              <span className={styles.label}>Notes de séance</span>
              <textarea
                className={styles.notes}
                rows={3}
                value={shownNotes}
                readOnly={viewing !== null}
                placeholder="Objectif, échauffement, matériel…"
                onChange={(changeEvent) => changeNotes(changeEvent.target.value)}
              />
            </label>
          </aside>

          <section className={styles.main} aria-label="Exercice">
            {selected ? (
              <DrillEditor
                key={`${viewCoach}:${selected.id}`}
                drill={selected}
                position={selectedPosition}
                readOnly={viewing !== null}
                onChange={changeDrill}
                actions={
                  viewing !== null ? null : confirmDelete === selected.id ? (
                    <span className={styles.confirm}>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => removeDrill(selected.id)}
                      >
                        Supprimer l’exercice
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Annuler
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Supprimer l’exercice"
                      title="Supprimer l’exercice"
                      onClick={() => setConfirmDelete(selected.id)}
                    >
                      <Icon name="trash" size={16} />
                    </Button>
                  )
                }
              />
            ) : (
              <p className={styles.muted}>
                {viewing
                  ? "Pas d’exercice dans cette préparation."
                  : "Aucun exercice pour l’instant : ajoute-en un, ou pioche dans la bibliothèque."}
              </p>
            )}
          </section>
        </div>
      )}

      {libraryOpen ? (
        <LibraryPanel
          clubId={clubId}
          events={libraryEvents.filter((item) => item.id !== event.id)}
          onClose={() => setLibraryOpen(false)}
          onAddDrills={(toAdd, importedNotes) => {
            addDrills(toAdd, importedNotes);
          }}
          onOpenSession={(eventId) => {
            setLibraryOpen(false);
            onOpenSession(eventId);
          }}
        />
      ) : null}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span className={styles.saveState} data-state={state} role="status">
      {state === "saving"
        ? "Enregistrement…"
        : state === "saved"
          ? "Enregistré"
          : "Échec de l’enregistrement"}
    </span>
  );
}
