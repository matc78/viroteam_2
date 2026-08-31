"use client";

import { useRef } from "react";
import type { ClubSetupDraft } from "@/lib/clubSetup/clubSetupDraft";
import { ClubSports } from "@/lib/clubSetup/constants";
import { ClubSetupUi } from "@/lib/clubSetup/clubSetupUi";
import { sportEmoji } from "@/lib/sports/sportEmoji";
import fieldStyles from "@/components/clubSetup/SetupFields.module.css";
import styles from "./IdentityStep.module.css";

type IdentityStepProps = {
  draft: ClubSetupDraft;
  onNameChange: (name: string) => void;
  onSportChange: (sport: string) => void;
  onLogoChange: (logoDataUrl: string | null) => void;
};

/** Étape identité — logo, nom et sport. */
export function IdentityStep({
  draft,
  onNameChange,
  onSportChange,
  onLogoChange,
}: IdentityStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sportAccent = ClubSetupUi.sportAccent(draft.sport);

  async function handleLogoPick(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onLogoChange(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className={styles.layout}>
      <div className={styles.topRow}>
        <section className={styles.section}>
          <div className={styles.identityStack}>
            <div className={styles.logoBlock}>
              <button
                type="button"
                className={styles.logoPreview}
                style={
                  { ["--logo-accent" as string]: sportAccent } as React.CSSProperties
                }
                onClick={() => fileInputRef.current?.click()}
                aria-label={
                  draft.logoDataUrl ? "Modifier le logo" : "Ajouter un logo"
                }
              >
                {draft.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.logoDataUrl} alt="" />
                ) : (
                  <span aria-hidden>{sportEmoji(draft.sport)}</span>
                )}
              </button>
              <button
                type="button"
                className={styles.logoAction}
                style={{ color: sportAccent }}
                onClick={() => fileInputRef.current?.click()}
              >
                {draft.logoDataUrl ? "Modifier" : "Logo"}
              </button>
              <input
                ref={fileInputRef}
                className={styles.hiddenInput}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  void handleLogoPick(file);
                }}
              />
            </div>

            <label className={`${fieldStyles.field} ${styles.nameField}`}>
              <span className={`${fieldStyles.label} ${styles.labelCompact}`}>
                Nom du club
              </span>
              <input
                className={`${fieldStyles.input} ${styles.inputCompact}`}
                style={
                  {
                    ["--field-accent" as string]: sportAccent,
                  } as React.CSSProperties
                }
                value={draft.name}
                placeholder="Ex. Viroflay Volley club"
                onChange={(event) => onNameChange(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sportSection}`}>
          <div className={fieldStyles.field}>
            <span className={`${fieldStyles.label} ${styles.labelCompact}`}>
              Sport
            </span>
            <div className={styles.sportGrid}>
              {ClubSports.all.map((sport) => {
                const selected = draft.sport === sport;
                const accent = ClubSetupUi.sportAccent(sport);
                return (
                  <button
                    key={sport}
                    type="button"
                    className={`${styles.sportButton} ${selected ? styles.sportButtonSelected : ""}`}
                    style={
                      selected
                        ? ({
                            ["--sport-accent" as string]: accent,
                          } as React.CSSProperties)
                        : undefined
                    }
                    onClick={() => onSportChange(sport)}
                    aria-pressed={selected}
                  >
                    {sportEmoji(sport)} {sport}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
