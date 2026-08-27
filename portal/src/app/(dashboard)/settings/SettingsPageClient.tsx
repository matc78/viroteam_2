"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { AccountSettingsSection } from "@/components/settings/AccountSettingsSection";
import { SettingsAccordion } from "@/components/settings/SettingsAccordion";
import { useToast } from "@/components/ToastProvider";
import {
  COACH_PERMISSION_LABELS,
  DEFAULT_COACH_PERMISSIONS,
  type CoachPermissions,
} from "@/lib/auth/coachPermissions";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  updateClubCoachPermissions,
  updateClubLogoUrl,
  updateClubSeasonEndDate,
} from "@/lib/firebase/clubService";
import { MemberRoles } from "@/lib/firebase/constants";
import { parseDateInput } from "@/lib/firebase/feeService";
import {
  clubLogoStoragePath,
  uploadImageAtPath,
} from "@/lib/firebase/storage";
import {
  defaultSeasonEndDate,
  isSeasonEndAfterMax,
  maxSeasonEndDate,
} from "@/lib/planning/seasonEnd";
import panelStyles from "@/components/dashboard/DashboardPanel.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import shared from "@/components/settings/settingsShared.module.css";

/** Formate une date locale en `YYYY-MM-DD`. */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Contenu page Paramètres bureau — club + compte. */
export function SettingsPageClient() {
  const { activeClub, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = useMemo(() => {
    if (!activeClub || !profile) return false;
    return profile.clubMemberships.some(
      (membership) =>
        membership.clubId === activeClub.id &&
        membership.role === MemberRoles.admin,
    );
  }, [activeClub, profile]);

  const [seasonDraft, setSeasonDraft] = useState("");
  const [seasonBusy, setSeasonBusy] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  const [draft, setDraft] = useState<CoachPermissions>(
    activeClub?.coachPermissions ?? DEFAULT_COACH_PERMISSIONS,
  );
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const maxSeason = useMemo(() => maxSeasonEndDate(), []);
  const maxSeasonInput = toDateInputValue(maxSeason);

  useEffect(() => {
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const resolved =
      activeClub?.seasonEndDate &&
      activeClub.seasonEndDate.getTime() >= todayStart.getTime()
        ? activeClub.seasonEndDate
        : defaultSeasonEndDate();
    setSeasonDraft(toDateInputValue(resolved));
    setSeasonError(null);
  }, [activeClub?.id, activeClub?.seasonEndDate]);

  useEffect(() => {
    setDraft(activeClub?.coachPermissions ?? DEFAULT_COACH_PERMISSIONS);
    setCoachError(null);
  }, [activeClub?.id, activeClub?.coachPermissions]);

  const coachDirty = useMemo(() => {
    const current = activeClub?.coachPermissions ?? DEFAULT_COACH_PERMISSIONS;
    return COACH_PERMISSION_LABELS.some(
      ({ key }) => draft[key] !== current[key],
    );
  }, [activeClub?.coachPermissions, draft]);

  const seasonDirty = useMemo(() => {
    const current = activeClub?.seasonEndDate
      ? toDateInputValue(activeClub.seasonEndDate)
      : toDateInputValue(defaultSeasonEndDate());
    return seasonDraft !== current;
  }, [activeClub?.seasonEndDate, seasonDraft]);

  async function handleSeasonSave(event: FormEvent) {
    event.preventDefault();
    if (!activeClub) return;
    const parsed = parseDateInput(seasonDraft);
    if (!parsed) {
      setSeasonError("Date invalide.");
      return;
    }
    if (isSeasonEndAfterMax(parsed)) {
      setSeasonError(
        `La fin de saison ne peut pas dépasser le ${maxSeasonInput} (31 juillet).`,
      );
      return;
    }
    setSeasonBusy(true);
    setSeasonError(null);
    try {
      await updateClubSeasonEndDate({
        clubId: activeClub.id,
        seasonEndDate: parsed,
      });
      await refreshProfile();
      showToast("Fin de saison enregistrée.", "success");
    } catch (saveError) {
      setSeasonError(
        saveError instanceof Error
          ? saveError.message
          : "Enregistrement impossible.",
      );
    } finally {
      setSeasonBusy(false);
    }
  }

  async function handleLogoChange(file: File | null) {
    if (!activeClub || !file) return;
    setLogoBusy(true);
    setLogoError(null);
    try {
      const bytes = await file.arrayBuffer();
      const contentType = file.type.startsWith("image/")
        ? file.type
        : "image/jpeg";
      const logoUrl = await uploadImageAtPath({
        path: clubLogoStoragePath(activeClub.id),
        bytes,
        contentType,
      });
      await updateClubLogoUrl({ clubId: activeClub.id, logoUrl });
      await refreshProfile();
      showToast("Logo du club mis à jour.", "success");
    } catch (uploadError) {
      setLogoError(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload logo impossible.",
      );
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleCoachSave() {
    if (!activeClub) return;
    setCoachBusy(true);
    setCoachError(null);
    try {
      await updateClubCoachPermissions({
        clubId: activeClub.id,
        permissions: draft,
      });
      await refreshProfile();
      showToast("Droits coachs enregistrés.", "success");
    } catch (saveError) {
      setCoachError(
        saveError instanceof Error
          ? saveError.message
          : "Enregistrement impossible.",
      );
    } finally {
      setCoachBusy(false);
    }
  }

  const clubInitial =
    (activeClub?.name ?? "C").trim().slice(0, 1).toUpperCase() || "C";

  return (
    <div className={`${transitionStyles.page} ${shared.stack}`}>
      <DashboardPageIntro
        eyebrow="Club"
        heading="Paramètres"
        lead={
          isAdmin
            ? `Configurer ${activeClub?.name ?? "le club"} et ton compte.`
            : "Gérer ton compte ViroTeam."
        }
      />

      {isAdmin ? (
        <section className={`${panelStyles.panel} ${shared.group}`} data-tone="cyan">
          <header className={shared.groupHeader}>
            <h2 className={shared.groupTitle}>Club</h2>
            <p className={shared.groupLead}>
              Saison, identité visuelle et droits des coachs.
            </p>
          </header>

          <div className={shared.accordionList}>
            <SettingsAccordion
              title="Fin de saison"
              description="Date limite pour le planning et les récurrences"
              defaultOpen
            >
              <form
                className={shared.fields}
                onSubmit={(event) => void handleSeasonSave(event)}
              >
                <label className={shared.field}>
                  <span className={shared.label}>Date de fin</span>
                  <input
                    className={shared.input}
                    type="date"
                    value={seasonDraft}
                    max={maxSeasonInput}
                    required
                    disabled={seasonBusy}
                    onChange={(event) => setSeasonDraft(event.target.value)}
                  />
                </label>
                <p className={shared.hint}>
                  Maximum : 31 juillet ({maxSeasonInput}).
                </p>
                {seasonError ? (
                  <p className={shared.error} role="alert">
                    {seasonError}
                  </p>
                ) : null}
                <div className={shared.actions}>
                  <button
                    type="submit"
                    className={shared.saveButton}
                    disabled={seasonBusy || !seasonDirty}
                  >
                    {seasonBusy ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </form>
            </SettingsAccordion>

            <SettingsAccordion
              title="Logo du club"
              description="Image affichée dans l’app et le portail"
            >
              <div className={shared.mediaRow}>
                {activeClub?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeClub.logoUrl}
                    alt=""
                    className={shared.logoPreview}
                  />
                ) : (
                  <span className={shared.logoFallback} aria-hidden="true">
                    {clubInitial}
                  </span>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className={shared.fileInput}
                  disabled={logoBusy}
                  onChange={(event) =>
                    void handleLogoChange(event.target.files?.[0] ?? null)
                  }
                />
              </div>
              {logoError ? (
                <p className={shared.error} role="alert">
                  {logoError}
                </p>
              ) : null}
              <div className={shared.actions}>
                <button
                  type="button"
                  className={shared.secondaryButton}
                  disabled={logoBusy}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {logoBusy ? "Upload…" : "Changer le logo"}
                </button>
              </div>
            </SettingsAccordion>

            <SettingsAccordion
              title="Droits des coachs"
              description="Actions visibles pour les coachs du club"
            >
              <ul className={shared.permissionList}>
                {COACH_PERMISSION_LABELS.map((item) => (
                  <li key={item.key} className={shared.permissionRow}>
                    <div>
                      <p className={shared.permissionLabel}>{item.label}</p>
                      <p className={shared.permissionHint}>
                        {item.description}
                      </p>
                    </div>
                    <label className={shared.toggle}>
                      <span className={shared.toggleLabel}>
                        {draft[item.key] ? "Oui" : "Non"}
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={draft[item.key]}
                        disabled={coachBusy}
                        aria-label={item.label}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [item.key]: event.target.checked,
                          }))
                        }
                      />
                      <span className={shared.toggleTrack} aria-hidden="true" />
                    </label>
                  </li>
                ))}
              </ul>
              {coachError ? (
                <p className={shared.error} role="alert">
                  {coachError}
                </p>
              ) : null}
              <div className={shared.actions}>
                {coachDirty ? (
                  <button
                    type="button"
                    className={shared.resetButton}
                    disabled={coachBusy}
                    onClick={() =>
                      setDraft(
                        activeClub?.coachPermissions ??
                          DEFAULT_COACH_PERMISSIONS,
                      )
                    }
                  >
                    Annuler
                  </button>
                ) : null}
                <button
                  type="button"
                  className={shared.saveButton}
                  disabled={coachBusy || !coachDirty}
                  onClick={() => void handleCoachSave()}
                >
                  {coachBusy ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </SettingsAccordion>
          </div>
        </section>
      ) : null}

      <AccountSettingsSection />
    </div>
  );
}
