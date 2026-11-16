"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CLUB_FUNCTIONS,
  CLUB_PERMISSIONS,
  PERMISSION_ADMIN,
  functionState,
  impliedByPermission,
  normalizePermissions,
  type ClubFunction,
  type ClubPermission,
} from "@/lib/auth/permissions";
import {
  COACH_PERMISSION_LABELS,
  type CoachPermissions,
} from "@/lib/auth/coachPermissions";
import { permissionsCopy } from "@/lib/copy/permissionsCopy";
import dialogStyles from "./DashboardDialog.module.css";
import styles from "./MemberPermissionsEditor.module.css";

type MemberPermissionsEditorProps = {
  /** Droits actuels de la fiche. */
  permissions: readonly ClubPermission[];
  /** `true` si la fiche entraîne au moins une équipe. */
  isTeamCoach?: boolean;
  /** Noms des équipes entraînées (affichage). */
  coachedTeamNames?: readonly string[];
  /** Flags coach du club (`clubs.coachPermissions`). */
  coachPermissions?: CoachPermissions;
  busy: boolean;
  /** Enregistre la liste choisie (callable `setMemberPermissions`). */
  onSave: (permissions: ClubPermission[]) => Promise<void>;
};

const FUNCTIONS = Object.keys(CLUB_FUNCTIONS) as ClubFunction[];

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

/**
 * Attribution des droits d’une fiche : capacités d’équipe (lecture seule),
 * droit Administrateur, raccourcis, puis détail droit par droit.
 * Même structure que l’app.
 */
export function MemberPermissionsEditor({
  permissions,
  isTeamCoach = false,
  coachedTeamNames = [],
  coachPermissions,
  busy,
  onSave,
}: MemberPermissionsEditorProps) {
  const [draft, setDraft] = useState<ClubPermission[]>([...permissions]);
  const permissionsKey = permissions.join(",");

  useEffect(() => {
    setDraft(permissionsKey ? (permissionsKey.split(",") as ClubPermission[]) : []);
  }, [permissionsKey]);

  const normalized = useMemo(() => normalizePermissions(draft), [draft]);
  const isAdmin = normalized.includes(PERMISSION_ADMIN);
  const changed = !sameList(normalized, normalizePermissions(permissions));
  const activeCoachFlags = coachPermissions
    ? COACH_PERMISSION_LABELS.filter((entry) => coachPermissions[entry.key])
    : [];

  function toggle(values: readonly ClubPermission[], enabled: boolean) {
    setDraft((current) =>
      enabled
        ? normalizePermissions([...current, ...values])
        : current.filter((permission) => !values.includes(permission)),
    );
  }

  return (
    <div className={styles.editor}>
      <p className={styles.hint}>{permissionsCopy.intro}</p>

      <fieldset className={styles.group} data-tone="shortcuts">
        <legend className={styles.legend}>
          {permissionsCopy.teamCapabilitiesLegend}
        </legend>
        <p className={styles.hint}>{permissionsCopy.teamCapabilitiesHint}</p>
        {!isTeamCoach ? (
          <p className={styles.hint}>{permissionsCopy.teamCapabilitiesEmpty}</p>
        ) : (
          <>
            {coachedTeamNames.length > 0 ? (
              <p className={styles.teamsLine}>
                {permissionsCopy.coachedTeamsLabel(coachedTeamNames.join(", "))}
              </p>
            ) : null}
            {activeCoachFlags.map((entry) => (
              <label key={entry.key} className={styles.option}>
                <input type="checkbox" checked disabled />
                <span>
                  <span className={styles.optionLabel}>{entry.label}</span>
                  <span className={styles.optionHint}>{entry.description}</span>
                </span>
              </label>
            ))}
          </>
        )}
      </fieldset>

      <p className={styles.clubLevelTitle}>{permissionsCopy.clubRightsLegend}</p>

      <fieldset className={styles.group} data-tone="danger">
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={isAdmin}
            disabled={busy}
            onChange={(event) => toggle([PERMISSION_ADMIN], event.target.checked)}
          />
          <span>
            <span className={styles.optionLabel}>
              {permissionsCopy.permissionLabel(PERMISSION_ADMIN)}
            </span>
            <span className={styles.optionHint}>{permissionsCopy.adminWarning}</span>
          </span>
        </label>
      </fieldset>

      <fieldset
        className={styles.group}
        data-tone="detail"
        disabled={busy || isAdmin}
      >
        <legend className={styles.legend}>{permissionsCopy.functionsLegend}</legend>
        <p className={styles.hint}>{permissionsCopy.functionsHint}</p>
        {FUNCTIONS.map((clubFunction) => {
          const state = functionState(clubFunction, normalized);
          const description = permissionsCopy.functionDescription(clubFunction);
          return (
            <label key={clubFunction} className={styles.option}>
              <input
                type="checkbox"
                checked={state === "full"}
                ref={(input) => {
                  if (input) input.indeterminate = state === "partial";
                }}
                // Partiel → coché : un clic complète la fonction.
                onChange={() => toggle(CLUB_FUNCTIONS[clubFunction], state !== "full")}
              />
              <span>
                <span className={styles.optionLabel}>
                  {permissionsCopy.functionLabel(clubFunction)}
                </span>
                <span className={styles.optionHint}>
                  {state === "partial"
                    ? `${description} · ${permissionsCopy.partial}`
                    : description}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <fieldset
        className={styles.group}
        data-tone="detail"
        disabled={busy || isAdmin}
      >
        <legend className={styles.legend}>{permissionsCopy.detailLegend}</legend>
        <p className={styles.hint}>{permissionsCopy.detailHint}</p>
        {CLUB_PERMISSIONS.filter((permission) => permission !== PERMISSION_ADMIN).map(
          (permission) => {
            // Droit accordé d'office par un autre (viewFees ← manageFees) :
            // coché et grisé tant que l'autre reste coché.
            const impliedBy = impliedByPermission(permission, normalized);
            return (
              <label key={permission} className={styles.option}>
                <input
                  type="checkbox"
                  checked={isAdmin || normalized.includes(permission)}
                  disabled={impliedBy !== null}
                  onChange={(event) =>
                    toggle([permission], event.target.checked)
                  }
                />
                <span>
                  <span className={styles.optionLabel}>
                    {permissionsCopy.permissionLabel(permission)}
                  </span>
                  <span className={styles.optionHint}>
                    {impliedBy
                      ? permissionsCopy.impliedBy(impliedBy)
                      : permissionsCopy.permissionDescription(permission)}
                  </span>
                </span>
              </label>
            );
          },
        )}
      </fieldset>

      <button
        type="button"
        className={dialogStyles.button}
        disabled={busy || !changed}
        onClick={() => void onSave(normalized)}
      >
        {busy ? permissionsCopy.saving : permissionsCopy.save}
      </button>
    </div>
  );
}
