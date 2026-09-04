"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { GuardianStatuses } from "@/lib/firebase/constants";
import {
  childDisplayName,
  childFirstName,
} from "@/lib/firebase/guardianService";
import { getLinkedMemberId } from "@/lib/firebase/memberService";

const TARGET_STORAGE_PREFIX = "viro.familyTarget.";

export type FamilyTarget = {
  memberId: string;
  /** Libellé court (puces switcher). */
  label: string;
  /** Nom visible header / accueil. */
  displayName: string;
  kind: "self" | "child";
};

type FamilyAudienceValue = {
  targets: FamilyTarget[];
  selectedMemberId: string | null;
  selectedTarget: FamilyTarget | null;
  setSelectedMemberId: (memberId: string) => void;
  loading: boolean;
};

const FamilyAudienceContext = createContext<FamilyAudienceValue | null>(null);

function readStoredTarget(clubId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${TARGET_STORAGE_PREFIX}${clubId}`);
  } catch {
    return null;
  }
}

function writeStoredTarget(clubId: string, memberId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${TARGET_STORAGE_PREFIX}${clubId}`, memberId);
  } catch {
    // ignore
  }
}

/** Résout Moi + enfants du club actif pour l’espace famille. */
export function FamilyAudienceProvider({ children }: { children: ReactNode }) {
  const { activeClub, profile, user } = useAuth();
  const [targets, setTargets] = useState<FamilyTarget[]>([]);
  const [selectedMemberId, setSelectedMemberIdState] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clubId = activeClub?.id;
    const uid = user?.uid;
    if (!clubId || !uid || !profile) {
      setTargets([]);
      setSelectedMemberIdState(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const childLinks = profile.parentLinks.filter(
        (link) =>
          link.clubId === clubId && link.status === GuardianStatuses.active,
      );
      const isLicensed = profile.clubMemberships.some(
        (membership) => membership.clubId === clubId,
      );

      const nextTargets: FamilyTarget[] = [];
      if (isLicensed) {
        const selfId = await getLinkedMemberId(clubId, uid);
        if (selfId) {
          const selfDisplay =
            profile.displayName.trim() ||
            [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
            "Moi";
          nextTargets.push({
            memberId: selfId,
            label: "Moi",
            displayName: selfDisplay,
            kind: "self",
          });
        }
      }
      for (const link of childLinks) {
        const [firstName, displayName] = await Promise.all([
          childFirstName(clubId, link.memberId),
          childDisplayName(clubId, link.memberId),
        ]);
        nextTargets.push({
          memberId: link.memberId,
          label: firstName,
          displayName,
          kind: "child",
        });
      }

      if (cancelled) return;
      setTargets(nextTargets);

      const stored = readStoredTarget(clubId);
      const storedValid = nextTargets.some(
        (target) => target.memberId === stored,
      );
      const preferred =
        (storedValid ? stored : null) ??
        nextTargets.find((target) => target.kind === "child")?.memberId ??
        nextTargets[0]?.memberId ??
        null;
      setSelectedMemberIdState(preferred);
      if (preferred) writeStoredTarget(clubId, preferred);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setTargets([]);
        setSelectedMemberIdState(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeClub?.id, profile, user?.uid]);

  const setSelectedMemberId = useCallback(
    (memberId: string) => {
      setSelectedMemberIdState(memberId);
      if (activeClub?.id) writeStoredTarget(activeClub.id, memberId);
    },
    [activeClub?.id],
  );

  const selectedTarget =
    targets.find((target) => target.memberId === selectedMemberId) ?? null;

  const value = useMemo<FamilyAudienceValue>(
    () => ({
      targets,
      selectedMemberId,
      selectedTarget,
      setSelectedMemberId,
      loading,
    }),
    [targets, selectedMemberId, selectedTarget, setSelectedMemberId, loading],
  );

  return (
    <FamilyAudienceContext.Provider value={value}>
      {children}
    </FamilyAudienceContext.Provider>
  );
}

/** Accède à la cible famille (Moi / enfant). */
export function useFamilyAudience(): FamilyAudienceValue {
  const ctx = useContext(FamilyAudienceContext);
  if (!ctx) {
    throw new Error("useFamilyAudience doit être utilisé dans FamilyAudienceProvider");
  }
  return ctx;
}
