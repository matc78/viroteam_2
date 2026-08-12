"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  colorForFilter,
  type FilterColorKind,
} from "@/lib/planning/calendarColors";
import {
  buildMonthGrid,
  dateOnly,
  formatDateId,
  type PlanningPersonOption,
  type TeamOption,
} from "@/lib/firebase/eventService";
import styles from "./PlanningSidebar.module.css";

/** Sélections de filtres latéraux du planning. */
export type PlanningSidebarFilters = {
  teamIds: string[];
  coachIds: string[];
  categories: string[];
  playerIds: string[];
};

/** Props de la barre latérale planning style agenda. */
type PlanningSidebarProps = {
  cursor: Date;
  selectedDay: Date;
  teams: TeamOption[];
  coaches: PlanningPersonOption[];
  players: PlanningPersonOption[];
  categories: string[];
  filters: PlanningSidebarFilters;
  onFiltersChange: (filters: PlanningSidebarFilters) => void;
  onCursorChange: (cursor: Date) => void;
  onDaySelect: (day: Date) => void;
  onCreateClick: () => void;
};

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function isSameDay(a: Date, b: Date): boolean {
  return formatDateId(a) === formatDateId(b);
}

/**
 * Sidebar Google-like : création, mini mois, calendriers par label
 * (équipes / coach / catégorie / joueur). Chaque case cochée affiche
 * les événements matchants dans sa couleur ; un événement multi-label
 * apparaît autant de fois que de labels actifs.
 */
export function PlanningSidebar({
  cursor,
  selectedDay,
  teams,
  coaches,
  players,
  categories,
  filters,
  onFiltersChange,
  onCursorChange,
  onDaySelect,
  onCreateClick,
}: PlanningSidebarProps) {
  const [openSections, setOpenSections] = useState({
    teams: true,
    coaches: true,
    categories: true,
    players: true,
  });

  const miniMonthCursor = useMemo(
    () => dateOnly(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
    [cursor],
  );
  const monthDays = useMemo(
    () => buildMonthGrid(miniMonthCursor),
    [miniMonthCursor],
  );
  const today = dateOnly(new Date());
  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(miniMonthCursor);

  function shiftMiniMonth(direction: -1 | 1) {
    const next = new Date(miniMonthCursor);
    next.setMonth(next.getMonth() + direction);
    onCursorChange(dateOnly(new Date(next.getFullYear(), next.getMonth(), 1)));
  }

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <aside className={styles.sidebar} aria-label="Navigation et filtres planning">
      <button type="button" className={styles.createButton} onClick={onCreateClick}>
        <span className={styles.createPlus} aria-hidden="true">
          +
        </span>
        Créer
      </button>

      <section className={styles.miniMonth} aria-label="Mini calendrier">
        <div className={styles.miniHeader}>
          <h2 className={styles.miniTitle}>{monthLabel}</h2>
          <div className={styles.miniNav}>
            <button
              type="button"
              className={styles.miniNavButton}
              aria-label="Mois précédent"
              onClick={() => shiftMiniMonth(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.miniNavButton}
              aria-label="Mois suivant"
              onClick={() => shiftMiniMonth(1)}
            >
              ›
            </button>
          </div>
        </div>

        <div className={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={`${label}-${index}`} className={styles.weekday}>
              {label}
            </span>
          ))}
        </div>

        <div className={styles.miniGrid}>
          {monthDays.map((day) => {
            const outside = day.getMonth() !== miniMonthCursor.getMonth();
            return (
              <button
                key={formatDateId(day)}
                type="button"
                className={styles.miniDay}
                data-outside={outside ? "true" : "false"}
                data-today={isSameDay(day, today) ? "true" : "false"}
                data-selected={isSameDay(day, selectedDay) ? "true" : "false"}
                onClick={() => onDaySelect(day)}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </section>

      <div className={styles.filters}>
        <FilterSection
          title="Équipes"
          open={openSections.teams}
          onToggle={() => toggleSection("teams")}
        >
          {teams.length === 0 ? (
            <p className={styles.emptyHint}>Aucune équipe</p>
          ) : (
            teams.map((team) => (
              <FilterOption
                key={team.id}
                kind="team"
                id={team.id}
                label={team.name}
                checked={filters.teamIds.includes(team.id)}
                onToggle={() =>
                  onFiltersChange({
                    ...filters,
                    teamIds: toggleId(filters.teamIds, team.id),
                  })
                }
              />
            ))
          )}
        </FilterSection>

        <FilterSection
          title="Coach"
          open={openSections.coaches}
          onToggle={() => toggleSection("coaches")}
        >
          {coaches.length === 0 ? (
            <p className={styles.emptyHint}>Aucun coach</p>
          ) : (
            coaches.map((coach) => (
              <FilterOption
                key={coach.id}
                kind="coach"
                id={coach.id}
                label={coach.name}
                checked={filters.coachIds.includes(coach.id)}
                onToggle={() =>
                  onFiltersChange({
                    ...filters,
                    coachIds: toggleId(filters.coachIds, coach.id),
                  })
                }
              />
            ))
          )}
        </FilterSection>

        <FilterSection
          title="Catégorie"
          open={openSections.categories}
          onToggle={() => toggleSection("categories")}
        >
          {categories.length === 0 ? (
            <p className={styles.emptyHint}>Aucune catégorie</p>
          ) : (
            categories.map((category) => (
              <FilterOption
                key={category}
                kind="category"
                id={category}
                label={category}
                checked={filters.categories.includes(category)}
                onToggle={() =>
                  onFiltersChange({
                    ...filters,
                    categories: toggleId(filters.categories, category),
                  })
                }
              />
            ))
          )}
        </FilterSection>

        <FilterSection
          title="Joueur"
          open={openSections.players}
          onToggle={() => toggleSection("players")}
        >
          {players.length === 0 ? (
            <p className={styles.emptyHint}>Aucun joueur</p>
          ) : (
            players.map((player) => (
              <FilterOption
                key={player.id}
                kind="player"
                id={player.id}
                label={player.name}
                checked={filters.playerIds.includes(player.id)}
                onToggle={() =>
                  onFiltersChange({
                    ...filters,
                    playerIds: toggleId(filters.playerIds, player.id),
                  })
                }
              />
            ))
          )}
        </FilterSection>
      </div>
    </aside>
  );
}

type FilterSectionProps = {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function FilterSection({ title, open, onToggle, children }: FilterSectionProps) {
  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.sectionToggle}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{title}</span>
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
      </button>
      {open ? <div className={styles.sectionBody}>{children}</div> : null}
    </section>
  );
}

type FilterOptionProps = {
  kind: FilterColorKind;
  id: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
};

/** Case filtre colorée (style Google Calendar). */
function FilterOption({ kind, id, label, checked, onToggle }: FilterOptionProps) {
  const color = colorForFilter(kind, id);
  return (
    <label className={styles.option}>
      <span
        className={styles.colorCheck}
        data-checked={checked ? "true" : "false"}
        style={{ "--filter-color": color } as CSSProperties}
      >
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </span>
      <span className={styles.optionLabel}>{label}</span>
    </label>
  );
}
