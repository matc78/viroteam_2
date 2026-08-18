"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";

/**
 * Lit `?clubId=` dans l’URL et pré-sélectionne le club actif
 * (ex. lien depuis l’app mobile).
 */
export function ClubIdFromUrlSync() {
  const searchParams = useSearchParams();
  const { adminClubs, setActiveClubId, status } = useAuth();

  useEffect(() => {
    if (status !== "signedIn") return;
    const clubId = searchParams.get("clubId")?.trim();
    if (!clubId) return;
    if (!adminClubs.some((club) => club.id === clubId)) return;
    setActiveClubId(clubId);
  }, [adminClubs, searchParams, setActiveClubId, status]);

  return null;
}
