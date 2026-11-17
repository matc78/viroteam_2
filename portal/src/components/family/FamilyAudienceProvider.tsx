"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { GuardianStatuses } from "@/lib/firebase/constants";
import {
  childNames,
} from "@/lib/firebase/guardianService";
import { getOwnMemberId } from "@/lib/firebase/memberRefs";
import {
  audienceForActiveClub,
  type FamilyAudienceResolution,
} from "@/lib/family/familyScope";

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
  // Cibles + sélection étiquetées par club : pendant la résolution d’un
  // nouveau club, l’ancien enfant n’est jamais exposé (pas de lecture
  // « nouveau club, ancien enfant »).
  const [resolution, setResolution] = useState<
    FamilyAudienceResolution<FamilyTarget>
  >({ clubId: null, targets: [], selectedMemberId: null });
  const [rawLoading, setLoading] = useState(true);

  useEffect(() => {
    const clubId = activeClub?.id;
    const uid = user?.uid;
    if (!clubId || !uid || !profile) {
      setResolution({ clubId: clubId ?? null, targets: [], selectedMemberId: null });
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
      const isLicensed = profile.memberClubIds.includes(clubId);

      // « Moi » et chaque enfant en parallèle (une lecture par fiche).
      const [selfId, children] = await Promise.all([
        isLicensed
          ? getOwnMemberId(clubId, uid).catch(() => null)
          : Promise.resolve(null),
        Promise.all(
          childLinks.map(async (link) => ({
            memberId: link.memberId,
            names: await childNames(clubId, link.memberId),
          })),
        ),
      ]);

      const nextTargets: FamilyTarget[] = [];
      if (isLicensed) {
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
      for (const child of children) {
        nextTargets.push({
          memberId: child.memberId,
          label: child.names.firstName,
          displayName: child.names.displayName,
          kind: "child",
        });
      }

      if (cancelled) return;

      const stored = readStoredTarget(clubId);
      const storedValid = nextTargets.some(
        (target) => target.memberId === stored,
      );
      const preferred =
        (storedValid ? stored : null) ??
        nextTargets.find((target) => target.kind === "child")?.memberId ??
        nextTargets[0]?.memberId ??
        null;
      setResolution({
        clubId,
        targets: nextTargets,
        selectedMemberId: preferred,
      });
      if (preferred) writeStoredTarget(clubId, preferred);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setResolution({ clubId, targets: [], selectedMemberId: null });
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeClub?.id, profile, user?.uid]);

  const activeClubId = activeClub?.id ?? null;
  const setSelectedMemberId = useCallback(
    (memberId: string) => {
      setResolution((current) =>
        current.clubId === activeClubId &&
        current.targets.some((target) => target.memberId === memberId)
          ? { ...current, selectedMemberId: memberId }
          : current,
      );
      if (activeClubId) writeStoredTarget(activeClubId, memberId);
    },
    [activeClubId],
  );

  const {
    targets,
    selectedMemberId,
    pending: resolutionPending,
  } = useMemo(
    () => audienceForActiveClub(resolution, activeClubId),
    [resolution, activeClubId],
  );
  const loading = rawLoading || resolutionPending;

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

/**
 * Lit `?memberId=` (deep link push) et sélectionne cette cible si elle fait
 * partie de Moi / mes enfants du club actif. À monter sous Suspense.
 */
export function FamilyTargetFromUrlSync() {
  const searchParams = useSearchParams();
  const { targets, setSelectedMemberId } = useFamilyAudience();
  const requestedMemberId = searchParams.get("memberId")?.trim() || null;
  /** Dernière demande appliquée (n’écrase pas un choix manuel ensuite). */
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!requestedMemberId) {
      appliedRef.current = null;
      return;
    }
    if (appliedRef.current === requestedMemberId) return;
    if (!targets.some((target) => target.memberId === requestedMemberId)) {
      return;
    }
    appliedRef.current = requestedMemberId;
    setSelectedMemberId(requestedMemberId);
  }, [requestedMemberId, targets, setSelectedMemberId]);

  return null;
}

/** Accède à la cible famille (Moi / enfant). */
export function useFamilyAudience(): FamilyAudienceValue {
  const ctx = useContext(FamilyAudienceContext);
  if (!ctx) {
    throw new Error("useFamilyAudience doit être utilisé dans FamilyAudienceProvider");
  }
  return ctx;
}
