import type { EventType, TeamOption } from "@/lib/firebase/eventService";
import { eventTypeLabel } from "@/lib/firebase/eventService";
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
        <select
          className={styles.select}
          value={selectedTeamId}
          onChange={(event) => onTeamChange(event.target.value)}
          aria-label="Filtrer par équipe"
        >
          <option value="all">Toutes les équipes</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Type</span>
        <select
          className={styles.select}
          value={selectedType}
          onChange={(event) =>
            onTypeChange(event.target.value as EventType | "all")
          }
          aria-label="Filtrer par type d'événement"
        >
          <option value="all">Tous les types</option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {eventTypeLabel(type)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
