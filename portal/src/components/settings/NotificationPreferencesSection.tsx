"use client";

import { useState } from "react";
import { SettingsAccordion } from "@/components/settings/SettingsAccordion";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  preferenceOffWarning,
  type CoachSummaryTiming,
  type NotificationPreferences,
  type NotificationToggleKey,
} from "@/lib/firebase/notificationPreferences";
import { updateNotificationPreferences } from "@/lib/firebase/userService";
import { CHAT_MESSAGING_LIVE } from "@/lib/featureFlags";
import shared from "@/components/settings/settingsShared.module.css";

const TOGGLE_ROWS: Array<{
  key: NotificationToggleKey;
  title: string;
  subtitle: string;
  /** Toggle inactif tant que cette préférence parente est coupée. */
  dependsOn?: NotificationToggleKey;
}> = [
  {
    key: "events",
    title: "Convocations et rappels",
    subtitle:
      "Nouvelle convocation, rappel 2 jours avant et le jour J, annulations",
  },
  {
    key: "weeklyDigest",
    title: "Récap de la semaine",
    subtitle: "Le dimanche soir : ton programme et les réponses attendues",
    dependsOn: "events",
  },
  {
    key: "rsvp",
    title: "Réponses aux convocations",
    subtitle:
      "Coachs : qui vient, qui ne vient pas. Parents : la réponse posée pour ton enfant",
  },
  {
    key: "rsvpTeammates",
    title: "Réponses des coéquipiers",
    subtitle: "Savoir qui vient aux entraînements et aux matchs",
    dependsOn: "rsvp",
  },
  {
    key: "announcements",
    title: "Annonces",
    subtitle: "À la publication d’une annonce",
  },
  {
    key: "fees",
    title: "Cotisations",
    subtitle: "Rappel chaque lundi soir",
  },
  {
    key: "chat",
    title: "Messagerie",
    subtitle: "Nouveaux messages dans tes discussions",
  },
];

const COACH_SUMMARY_OPTIONS: Array<{ value: CoachSummaryTiming; label: string }> = [
  { value: "j2", label: "2 jours avant" },
  { value: "eve", label: "La veille au soir" },
  { value: "day", label: "Avec le rappel du jour J" },
];

function visibleToggleRows() {
  return TOGGLE_ROWS.filter(
    (row) => row.key !== "chat" || CHAT_MESSAGING_LIVE,
  );
}

/**
 * Accordion préférences push (bureau + famille). [showCoachSummary] affiche
 * le moment du bilan des réponses (bureau : staff du club).
 */
export function NotificationPreferencesSection({
  showCoachSummary = false,
}: {
  showCoachSummary?: boolean;
} = {}) {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const prefs =
    profile?.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES;

  async function setPreference(key: NotificationToggleKey, enabled: boolean) {
    // Les réponses des coéquipiers sont un opt-in : pas de confirmation au retrait.
    if (!enabled && key !== "rsvpTeammates") {
      const accepted = window.confirm(preferenceOffWarning(key));
      if (!accepted) return;
    }
    await savePreferences(key, { ...prefs, [key]: enabled });
  }

  async function savePreferences(
    busy: keyof NotificationPreferences,
    next: NotificationPreferences,
  ) {
    if (!user || !profile) return;
    setBusyKey(busy);
    try {
      await updateNotificationPreferences({
        uid: user.uid,
        preferences: next,
      });
      await refreshProfile();
      showToast("Préférence enregistrée.", "success");
    } catch {
      showToast("Impossible d’enregistrer la préférence.", "error");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <SettingsAccordion
      title="Notifications"
      description="Choisis quels rappels tu reçois dans le navigateur et sur mobile."
      defaultOpen={false}
    >
      <div className={shared.stack}>
        {visibleToggleRows().map((row) => {
          const parentOff = row.dependsOn != null && !prefs[row.dependsOn];
          return (
          <label key={row.key} className={shared.checkRow}>
            <input
              type="checkbox"
              checked={prefs[row.key] && !parentOff}
              disabled={busyKey === row.key || parentOff}
              onChange={(event) =>
                void setPreference(row.key, event.target.checked)
              }
            />
            <span>
              <strong>{row.title}</strong>
              <br />
              <span className={shared.hint}>{row.subtitle}</span>
            </span>
          </label>
          );
        })}
        {showCoachSummary ? (
          <label className={shared.checkRow}>
            <span>
              <strong>Bilan des réponses</strong>
              <br />
              <span className={shared.hint}>
                Coachs : le décompte de qui vient, au moment choisi
              </span>
              <br />
              <select
                value={prefs.coachSummaryTiming}
                disabled={busyKey === "coachSummaryTiming" || !prefs.events}
                onChange={(event) =>
                  void savePreferences("coachSummaryTiming", {
                    ...prefs,
                    coachSummaryTiming: event.target.value as CoachSummaryTiming,
                  })
                }
              >
                {COACH_SUMMARY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
        ) : null}
      </div>
    </SettingsAccordion>
  );
}
