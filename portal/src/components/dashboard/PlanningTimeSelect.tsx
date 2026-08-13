"use client";

import { useMemo } from "react";
import { PlanningSelect } from "./PlanningSelect";

type PlanningTimeSelectProps = {
  id: string;
  value: string;
  options: string[];
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
  onChange: (value: string) => void;
};

/**
 * Sélecteur d'heure style Google Calendar : liste scrollable centrée
 * sur la valeur courante, avec ~5 créneaux visibles à l'ouverture.
 */
export function PlanningTimeSelect({
  id,
  value,
  options,
  disabled = false,
  required = false,
  "aria-label": ariaLabel,
  onChange,
}: PlanningTimeSelectProps) {
  const selectOptions = useMemo(
    () => options.map((option) => ({ value: option, label: option })),
    [options],
  );

  return (
    <PlanningSelect
      id={id}
      value={value}
      options={selectOptions}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      visibleNeighbors={2}
      onChange={onChange}
    />
  );
}
