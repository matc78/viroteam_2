"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import type { ClubRecord } from "@/lib/firebase/clubService";
import {
  getActiveSeason,
  getMemberFee,
  isFeeDeadlineUrgentDay,
} from "@/lib/firebase/feeService";
import { getLinkedMemberId } from "@/lib/firebase/memberService";

async function loadFeeDeadlineUrgent(
  club: ClubRecord,
  memberId: string,
): Promise<boolean> {
  const season = await getActiveSeason(club.id);
  if (!season) return false;
  const fee = await getMemberFee(club.id, season.id, memberId);
  if (!fee) return false;
  return isFeeDeadlineUrgentDay(fee, season);
}

/** Fond rouge portail si cotisation due et échéance aujourd'hui. */
export function usePlayerFeeDeadlineUrgency(): boolean {
  const { activeClub, user } = useAuth();
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (!activeClub || !user) {
      setUrgent(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const memberId = await getLinkedMemberId(activeClub.id, user.uid);
      if (!memberId || cancelled) {
        if (!cancelled) setUrgent(false);
        return;
      }
      const result = await loadFeeDeadlineUrgent(activeClub, memberId);
      if (!cancelled) setUrgent(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeClub, user]);

  return urgent;
}

/** Fond rouge espace famille si échéance aujourd'hui pour le membre suivi. */
export function useFamilyFeeDeadlineUrgency(
  selectedMemberId: string | null,
): boolean {
  const { activeClub } = useAuth();
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (!activeClub || !selectedMemberId) {
      setUrgent(false);
      return;
    }

    let cancelled = false;
    void loadFeeDeadlineUrgent(activeClub, selectedMemberId).then((result) => {
      if (!cancelled) setUrgent(result);
    });

    return () => {
      cancelled = true;
    };
  }, [activeClub, selectedMemberId]);

  return urgent;
}
