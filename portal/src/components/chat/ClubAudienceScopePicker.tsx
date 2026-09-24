"use client";

import { useMemo, type CSSProperties } from "react";
import type { TeamOption } from "@/lib/firebase/eventService";
import {
  CHANNEL_AUDIENCE_SCOPE_LABELS,
  type ChannelAudienceScope,
  type ChannelAudienceScopeType,
} from "@/lib/chat/channelAudienceScope";
import {
  compareTeamCategories,
  sortTeamCategories,
} from "@/lib/teams/compareTeamCategories";
import styles from "./ClubAudienceScopePicker.module.css";

type ScopeOption = {
  id: string;
  label: string;
};

type ClubAudienceScopePickerProps = {
  teams: TeamOption[];
  categories: string[];
  value: ChannelAudienceScope;
  disabled?: boolean;
  /** Couleur de marque du club (fond chips sélectionnés). */
  accentColor?: string;
  /** Texte lisible sur [accentColor]. */
  accentTextColor?: string;
  onChange: (value: ChannelAudienceScope) => void;
};

const SCOPE_ORDER: ChannelAudienceScopeType[] = [
  "categories",
  "teams",
  "parents",
];

/**
 * Sélecteur d’audience club : un mode (catégories / équipes / parents)
 * puis multi-sélection parmi des valeurs connues — pas de saisie libre.
 */
export function ClubAudienceScopePicker({
  teams,
  categories,
  value,
  disabled = false,
  accentColor,
  accentTextColor,
  onChange,
}: ClubAudienceScopePickerProps) {
  const options = useMemo((): ScopeOption[] => {
    if (value.scopeType === "categories") {
      return sortTeamCategories(categories).map((category) => ({
        id: category,
        label: category,
      }));
    }

    const selectableTeams = teams
      .filter((team) => {
        if (value.scopeType === "parents") {
          return team.playerIds.some((id) => id.trim().length > 0);
        }
        return team.name.trim().length > 0;
      })
      .slice()
      .sort((a, b) => {
        const byCategory = compareTeamCategories(a.category, b.category);
        if (byCategory !== 0) return byCategory;
        return a.name.localeCompare(b.name, "fr");
      });

    return selectableTeams.map((team) => ({
      id: team.id,
      label:
        value.scopeType === "parents"
          ? `Parents · ${team.name}`
          : team.category
            ? `${team.name} (${team.category})`
            : team.name,
    }));
  }, [categories, teams, value.scopeType]);

  const selected = useMemo(() => new Set(value.scopeIds), [value.scopeIds]);

  const accentStyle = useMemo((): CSSProperties | undefined => {
    if (!accentColor) return undefined;
    return {
      "--scope-accent": accentColor,
      "--scope-accent-text": accentTextColor ?? "#fff",
    } as CSSProperties;
  }, [accentColor, accentTextColor]);

  function setScopeType(scopeType: ChannelAudienceScopeType) {
    if (scopeType === value.scopeType) return;
    onChange({ scopeType, scopeIds: [] });
  }

  function toggleId(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({
      scopeType: value.scopeType,
      scopeIds: Array.from(next),
    });
  }

  const optionsHint =
    value.scopeType === "categories"
      ? "Catégories des équipes du club"
      : value.scopeType === "parents"
        ? "Équipes avec joueurs"
        : "Équipes du club";

  return (
    <div className={styles.root} style={accentStyle}>
      <div className={styles.modes} role="tablist" aria-label="Type de cible">
        {SCOPE_ORDER.map((scopeType) => (
          <button
            key={scopeType}
            type="button"
            role="tab"
            className={styles.modeBtn}
            data-selected={value.scopeType === scopeType ? "true" : "false"}
            aria-selected={value.scopeType === scopeType}
            disabled={disabled}
            onClick={() => setScopeType(scopeType)}
          >
            {CHANNEL_AUDIENCE_SCOPE_LABELS[scopeType]}
          </button>
        ))}
      </div>

      {options.length === 0 ? (
        <p className={styles.empty}>
          {value.scopeType === "categories"
            ? "Aucune catégorie sur les équipes du club."
            : value.scopeType === "parents"
              ? "Aucune équipe avec joueurs."
              : "Aucune équipe dans ce club."}
        </p>
      ) : (
        <>
          <p className={styles.optionsLabel}>{optionsHint}</p>
          <div className={styles.options} role="group" aria-label="Cibles">
            {options.map((option) => {
              const isSelected = selected.has(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={styles.option}
                  data-selected={isSelected ? "true" : "false"}
                  aria-pressed={isSelected}
                  disabled={disabled}
                  onClick={() => toggleId(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
