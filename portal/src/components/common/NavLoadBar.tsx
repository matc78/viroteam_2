"use client";

import { useEffect, useReducer, useState } from "react";
import {
  initialNavLoadBarState,
  NAV_LOAD_BAR_EXIT_MS,
  NAV_LOAD_BAR_SHOW_DELAY_MS,
  navLoadBarReducer,
} from "@/components/common/navLoadBarPhase";
import styles from "./NavLoadBar.module.css";

type NavLoadBarProps = {
  /** True tant que la navigation vers un onglet est en cours. */
  active: boolean;
  /** Classe de ton du shell (fournit `--nav-tone`). */
  toneClassName?: string;
};

/**
 * Bande teintée à la couleur de l’onglet ciblé, qui se remplit de gauche à
 * droite en fond de la ligne d’onglets pendant le chargement de la page.
 * À placer dans un conteneur `position: relative; isolation: isolate` qui
 * définit `--nav-tone` (et éventuellement `--nav-load-mix`, 16 % par défaut).
 */
export function NavLoadBar({ active, toneClassName }: NavLoadBarProps) {
  const [{ phase, runId }, dispatch] = useReducer(
    navLoadBarReducer,
    initialNavLoadBarState,
  );
  const [shownTone, setShownTone] = useState<string | undefined>(undefined);
  /** Run dont la transition est armée (une frame après le montage à 0). */
  const [armedRunId, setArmedRunId] = useState(0);

  useEffect(() => {
    if (active && toneClassName) setShownTone(toneClassName);
  }, [active, toneClassName]);

  useEffect(() => {
    dispatch(active ? "activate" : "deactivate");
  }, [active]);

  useEffect(() => {
    if (phase !== "waiting" && phase !== "done") return;
    const delay =
      phase === "waiting" ? NAV_LOAD_BAR_SHOW_DELAY_MS : NAV_LOAD_BAR_EXIT_MS;
    const timer = setTimeout(() => dispatch("timer"), delay);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (runId === 0) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setArmedRunId(runId));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [runId]);

  if (phase === "idle" || phase === "waiting") return null;

  return (
    <span
      key={runId}
      aria-hidden="true"
      className={[
        styles.bar,
        shownTone ?? "",
        phase === "filling" && armedRunId === runId ? styles.filling : "",
        phase === "done" ? styles.done : "",
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
