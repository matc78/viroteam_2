"use client";

import { useState } from "react";
import { SettingsAccordion } from "@/components/settings/SettingsAccordion";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  preferenceOffWarning,
  type NotificationPreferences,
} from "@/lib/firebase/notificationPreferences";
import { updateNotificationPreferences } from "@/lib/firebase/userService";
import { CHAT_MESSAGING_LIVE } from "@/lib/featureFlags";
import shared from "@/components/settings/settingsShared.module.css";

const TOGGLE_ROWS: Array<{
  key: keyof NotificationPreferences;
  title: string;
  subtitle: string;
  /** Toggle inactif tant que cette préférence parente est coupée. */
  dependsOn?: keyof NotificationPreferences;
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

function visibleToggleRows() {
  return TOGGLE_ROWS.filter(
    (row) => row.key !== "chat" || CHAT_MESSAGING_LIVE,
  );
}

/** Accordion préférences push (bureau + famille). */
export function NotificationPreferencesSection() {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const prefs =
    profile?.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES;

  async function setPreference(
    key: keyof NotificationPreferences,
    enabled: boolean,
  ) {
    if (!user || !profile) return;
    // Les réponses des coéquipiers sont un opt-in : pas de confirmation au retrait.
    if (!enabled && key !== "rsvpTeammates") {
      const accepted = window.confirm(preferenceOffWarning(key));
      if (!accepted) return;
    }
    setBusyKey(key);
    try {
      const next = { ...prefs, [key]: enabled };
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
      </div>
    </SettingsAccordion>
  );
}
