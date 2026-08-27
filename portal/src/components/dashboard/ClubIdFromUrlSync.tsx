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
  const { bureauClubs, familyClubs, setActiveClubId, status } = useAuth();

  useEffect(() => {
    if (status !== "signedIn") return;
    const clubId = searchParams.get("clubId")?.trim();
    if (!clubId) return;
    const allowed = [...bureauClubs, ...familyClubs].some(
      (club) => club.id === clubId,
    );
    if (!allowed) return;
    setActiveClubId(clubId);
  }, [bureauClubs, familyClubs, searchParams, setActiveClubId, status]);

  return null;
}
