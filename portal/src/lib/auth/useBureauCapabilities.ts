"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  bureauCapabilities,
  type BureauCapabilities,
} from "@/lib/auth/bureauPermissions";

/**
 * Capacités Bureau du compte dans le club actif (droits de sa fiche
 * `members/{uid}`, suivie en temps réel). Point d’entrée des pages : elles
 * ne relisent jamais un rôle ni les droits bruts.
 */
export function useBureauCapabilities(): BureauCapabilities {
  const { activeClubAccess } = useAuth();
  return useMemo(() => bureauCapabilities(activeClubAccess), [activeClubAccess]);
}
