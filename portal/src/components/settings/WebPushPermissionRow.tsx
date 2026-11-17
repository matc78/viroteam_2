"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/Button";
import { notificationsCopy } from "@/lib/copy/notificationsCopy";
import type { WebPushAvailability } from "@/lib/firebase/pushNotificationService";
import shared from "@/components/settings/settingsShared.module.css";

/** Module push chargé à la demande (Firebase Messaging hors bundle initial). */
function loadPushModule() {
  return import("@/lib/firebase/pushNotificationService");
}

/**
 * Ligne « Notifications sur ce navigateur » : la permission navigateur n’est
 * demandée qu’au clic sur « Activer » (jamais sans geste utilisateur).
 * Masquée si le push web n’est pas configuré ou pas pris en charge.
 */
export function WebPushPermissionRow() {
  const { showToast } = useToast();
  const [availability, setAvailability] = useState<WebPushAvailability | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPushModule()
      .then(({ webPushAvailability }) => webPushAvailability())
      .then((state) => {
        if (!cancelled) setAvailability(state);
      })
      .catch(() => {
        if (!cancelled) setAvailability("unsupported");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable() {
    setBusy(true);
    try {
      const { enableWebPush } = await loadPushModule();
      const permission = await enableWebPush();
      if (permission) setAvailability(permission);
    } catch {
      showToast(notificationsCopy.browserPushFailed, "error");
    } finally {
      setBusy(false);
    }
  }

  if (
    availability === null ||
    availability === "unconfigured" ||
    availability === "unsupported"
  ) {
    return null;
  }

  const hint =
    availability === "granted"
      ? notificationsCopy.browserPushGranted
      : availability === "denied"
        ? notificationsCopy.browserPushDenied
        : notificationsCopy.browserPushDefault;

  return (
    <li className={shared.permissionRow}>
      <div>
        <p className={shared.permissionLabel}>
          {notificationsCopy.browserPushTitle}
        </p>
        <p className={shared.permissionHint}>{hint}</p>
      </div>
      {availability === "default" ? (
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => void handleEnable()}
        >
          {busy
            ? notificationsCopy.browserPushEnabling
            : notificationsCopy.browserPushEnable}
        </Button>
      ) : null}
    </li>
  );
}
