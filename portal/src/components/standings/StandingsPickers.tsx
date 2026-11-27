"use client";

import type { PoolState } from "@/components/standings/usePoolStates";
import {
  bestStandingRank,
  entryLabel,
  entryTeamKeys,
  rankMedal,
  type StandingsCategoryGroup,
  type StandingsEntry,
} from "@/lib/standings/standingsGroups";
import styles from "./StandingsPickers.module.css";

/** Meilleur rang des équipes suivies de [entry], une fois sa poule chargée. */
function entryRank(
  entry: StandingsEntry,
  pools: Record<string, PoolState>,
): number | null {
  const pool = pools[entry.key];
  return pool?.status === "ready"
    ? bestStandingRank(pool.data.standings, entryTeamKeys(entry))
    : null;
}

/** Pastille de rang (médaille sur le podium et en 4e). */
function RankBadge({ rank }: { rank: number | null }) {
  return (
    <span
      className={styles.rank}
      data-medal={(rank ? rankMedal(rank) : null) ?? undefined}
      aria-label={rank ? `${rank}e` : undefined}
    >
      {rank ?? "–"}
    </span>
  );
}

type PickerProps = {
  pools: Record<string, PoolState>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

/**
 * Sélecteur « Mes classements » (quelques équipes) : une puce par poule,
 * sur une ligne au-dessus du tableau. Le club n’est rappelé que si le
 * compte suit des équipes de plusieurs clubs.
 */
export function StandingsTeamChips({
  entries,
  showClubName,
  pools,
  selectedKey,
  onSelect,
}: PickerProps & { entries: readonly StandingsEntry[]; showClubName: boolean }) {
  return (
    <ul className={styles.chips} aria-label="Mes équipes">
      {entries.map((entry) => {
        const selected = entry.key === selectedKey;
        const meta = [
          showClubName ? entry.clubName : null,
          entry.childNames.join(", ") || null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={entry.key}>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={selected}
              onClick={() => onSelect(entry.key)}
            >
              <RankBadge rank={entryRank(entry, pools)} />
              <span className={styles.chipText}>
                <span className={styles.chipName}>{entryLabel(entry)}</span>
                {meta ? <span className={styles.chipMeta}>{meta}</span> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Sélecteur de l’onglet Classements d’un club (beaucoup d’équipes) : liste
 * compacte groupée par catégorie en colonne, menu déroulant sur mobile.
 */
export function StandingsCategoryList({
  groups,
  pools,
  selectedKey,
  onSelect,
}: PickerProps & { groups: readonly StandingsCategoryGroup[] }) {
  return (
    <>
      <label className={styles.mobileSelect}>
        <span className="sr-only">Équipe</span>
        <select
          value={selectedKey ?? ""}
          onChange={(event) => onSelect(event.target.value)}
        >
          {groups.map((group) => (
            <optgroup key={group.category} label={group.category}>
              {group.entries.map((entry) => {
                const rank = entryRank(entry, pools);
                return (
                  <option key={entry.key} value={entry.key}>
                    {entryLabel(entry)}
                    {rank ? ` (${rank}e)` : ""}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
      </label>

      <nav className={styles.list} aria-label="Équipes du club">
        {groups.map((group) => (
          <section
            key={group.category}
            className={styles.group}
            data-tone={group.tone}
            aria-label={group.category}
          >
            <p className={styles.groupTitle} aria-hidden>
              <span className={styles.toneDot} />
              {group.category}
            </p>
            <ul className={styles.rows}>
              {group.entries.map((entry) => {
                const selected = entry.key === selectedKey;
                return (
                  <li key={entry.key}>
                    <button
                      type="button"
                      className={styles.row}
                      aria-current={selected ? "true" : undefined}
                      onClick={() => onSelect(entry.key)}
                    >
                      <RankBadge rank={entryRank(entry, pools)} />
                      <span className={styles.rowName}>{entryLabel(entry)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </>
  );
}
