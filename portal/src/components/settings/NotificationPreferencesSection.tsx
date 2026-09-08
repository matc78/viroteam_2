"use client";

import { useState } from "react";
import { SettingsAccordion } from "@/components/settings/SettingsAccordion";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  preferenceOffWarning,
  type NotificationPreferences,
} from "@/lib/firebase/notificationPreferences";
import { updateNotificationPreferences } from "@/lib/firebase/userService";
import shared from "@/components/settings/settingsShared.module.css";

const TOGGLE_ROWS: Array<{
  key: keyof NotificationPreferences;
  title: string;
  subtitle: string;
}> = [
  {
    key: "events",
    title: "Événements",
    subtitle: "Rappels J-7 / J-2 et envois coaches",
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
];

/** Accordion préférences push (bureau + famille). */
export function NotificationPreferencesSection() {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const prefs = profile?.notificationPreferences ?? {
    events: true,
    announcements: true,
    fees: true,
  };

  async function setPreference(
    key: keyof NotificationPreferences,
    enabled: boolean,
  ) {
    if (!user || !profile) return;
    if (!enabled) {
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
        {TOGGLE_ROWS.map((row) => (
          <label key={row.key} className={shared.checkRow}>
            <input
              type="checkbox"
              checked={prefs[row.key]}
              disabled={busyKey === row.key}
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
        ))}
      </div>
    </SettingsAccordion>
  );
}
