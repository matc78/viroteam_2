"use client";

import type { EventType, TeamOption } from "@/lib/firebase/eventService";
import { eventTypeLabel } from "@/lib/firebase/eventService";
import { PlanningSelect } from "./PlanningSelect";
import styles from "./PlanningFilters.module.css";

/** Props des filtres planning (équipe + type). */
type PlanningFiltersProps = {
  teams: TeamOption[];
  selectedTeamId: string;
  selectedType: EventType | "all";
  onTeamChange: (teamId: string) => void;
  onTypeChange: (type: EventType | "all") => void;
};

const EVENT_TYPES: EventType[] = ["training", "match", "tournament", "other"];

/** Filtres équipe et type pour la page planning. */
export function PlanningFilters({
  teams,
  selectedTeamId,
  selectedType,
  onTeamChange,
  onTypeChange,
}: PlanningFiltersProps) {
  return (
    <div className={styles.row}>
      <label className={styles.field}>
        <span className={styles.label}>Équipe</span>
        <PlanningSelect
          id="planning-filter-team"
          value={selectedTeamId}
          aria-label="Filtrer par équipe"
          options={[
            { value: "all", label: "Toutes les équipes" },
            ...teams.map((team) => ({
              value: team.id,
              label: team.name,
            })),
          ]}
          onChange={onTeamChange}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Type</span>
        <PlanningSelect
          id="planning-filter-type"
          value={selectedType}
          aria-label="Filtrer par type d'événement"
          options={[
            { value: "all", label: "Tous les types" },
            ...EVENT_TYPES.map((type) => ({
              value: type,
              label: eventTypeLabel(type),
            })),
          ]}
          onChange={(next) => onTypeChange(next as EventType | "all")}
        />
      </label>
    </div>
  );
}
