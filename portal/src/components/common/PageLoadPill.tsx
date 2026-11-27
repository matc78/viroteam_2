"use client";

import { useEffect, useReducer } from "react";
import {
  initialNavLoadBarState,
  navLoadBarReducer,
} from "@/components/common/navLoadBarPhase";
import type { PageLoadOutcome } from "@/components/common/PageLoadProvider";
import styles from "./PageLoadPill.module.css";

/** Délai avant affichage : rien ne s’affiche si la page est déjà en cache. */
export const PAGE_LOAD_PILL_SHOW_DELAY_MS = 200;

/** Durée pendant laquelle « Prêt » reste visible avant le fondu. */
export const PAGE_LOAD_PILL_DONE_MS = 900;

/**
 * Pastille flottante en bas de l’écran pendant une navigation : point orange
 * qui pulse et « Chargement… », puis point vert « Prêt » avant de disparaître.
 * Mêmes phases que la barre des onglets (`navLoadBarReducer`). Décorative
 * (`aria-hidden`) : le lecteur d’écran annonce déjà le changement de page.
 */
export function PageLoadPill({
  active,
  outcome,
}: {
  active: boolean;
  /** Fin de la dernière navigation : « Prêt » seulement si la page l’a signalé. */
  outcome: PageLoadOutcome;
}) {
  const [{ phase, runId }, dispatch] = useReducer(
    navLoadBarReducer,
    initialNavLoadBarState,
  );

  useEffect(() => {
    if (active) dispatch("activate");
    else dispatch(outcome === "ready" ? "deactivate" : "abort");
    // `outcome` est fixé en même temps que la fin : seul `active` déclenche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (phase !== "waiting" && phase !== "done") return;
    const delay =
      phase === "waiting"
        ? PAGE_LOAD_PILL_SHOW_DELAY_MS
        : PAGE_LOAD_PILL_DONE_MS;
    const timer = setTimeout(() => dispatch("timer"), delay);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "idle" || phase === "waiting") return null;

  const done = phase === "done";
  return (
    <div
      key={runId}
      className={styles.pill}
      data-state={done ? "done" : "loading"}
      aria-hidden="true"
    >
      <span className={styles.dot} />
      <span className={styles.label}>{done ? "Prêt" : "Chargement"}</span>
      {done ? null : (
        <span className={styles.ellipsis}>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      )}
    </div>
  );
}
