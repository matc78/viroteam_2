"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearDraftStorage,
  createEmptyClubSetupDraft,
  loadDraftFromStorage,
  persistDraftToStorage,
  persistLogoToStorage,
  type ClubSetupDraft,
  type PracticeLocation,
} from "./clubSetupDraft";

const PERSIST_DEBOUNCE_MS = 300;

type UseClubSetupDraftResult = {
  draft: ClubSetupDraft;
  isReady: boolean;
  hadPersistedDraft: boolean;
  setCurrentStep: (step: number) => void;
  setName: (name: string) => void;
  setSport: (sport: string) => void;
  setDescription: (description: string) => void;
  setBrandColorHex: (brandColorHex: string) => void;
  setLogoDataUrl: (logoDataUrl: string | null) => void;
  toggleObjective: (key: string) => void;
  setMemberCountRange: (range: string | null) => void;
  setCity: (city: string) => void;
  setPostalCode: (postalCode: string) => void;
  setAddress: (address: string) => void;
  setPracticeLocations: (locations: PracticeLocation[]) => void;
  addPracticeLocation: (location: PracticeLocation) => void;
  removePracticeLocation: (index: number) => void;
  replaceDraft: (draft: ClubSetupDraft) => void;
  resetAndClear: () => void;
  persistImmediately: () => void;
};

/**
 * État du brouillon wizard avec persistance localStorage debounced.
 */
export function useClubSetupDraft(userId: string | null): UseClubSetupDraftResult {
  const [draft, setDraft] = useState<ClubSetupDraft>(createEmptyClubSetupDraft);
  const [isReady, setIsReady] = useState(false);
  const [hadPersistedDraft, setHadPersistedDraft] = useState(false);
  const draftRef = useRef(draft);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  draftRef.current = draft;

  const persistImmediately = useCallback(() => {
    if (!userId) return;
    persistDraftToStorage(userId, draftRef.current);
    persistLogoToStorage(userId, draftRef.current.logoDataUrl);
  }, [userId]);

  const schedulePersist = useCallback(() => {
    if (!userId) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistImmediately();
    }, PERSIST_DEBOUNCE_MS);
  }, [persistImmediately, userId]);

  useEffect(() => {
    if (!userId) {
      setDraft(createEmptyClubSetupDraft());
      setIsReady(true);
      setHadPersistedDraft(false);
      return;
    }

    const restored = loadDraftFromStorage(userId);
    if (restored) {
      setDraft(restored);
      setHadPersistedDraft(true);
    } else {
      setDraft(createEmptyClubSetupDraft());
      setHadPersistedDraft(false);
    }
    setIsReady(true);
  }, [userId]);

  useEffect(() => {
    if (!isReady) return;
    schedulePersist();
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [draft, isReady, schedulePersist]);

  const updateDraft = useCallback(
    (updater: (current: ClubSetupDraft) => ClubSetupDraft) => {
      setDraft((current) => updater(current));
    },
    [],
  );

  const setCurrentStep = useCallback(
    (step: number) => updateDraft((current) => ({ ...current, currentStep: step })),
    [updateDraft],
  );

  const setName = useCallback(
    (name: string) => updateDraft((current) => ({ ...current, name })),
    [updateDraft],
  );

  const setSport = useCallback(
    (sport: string) => updateDraft((current) => ({ ...current, sport })),
    [updateDraft],
  );

  const setDescription = useCallback(
    (description: string) => updateDraft((current) => ({ ...current, description })),
    [updateDraft],
  );

  const setBrandColorHex = useCallback(
    (brandColorHex: string) => updateDraft((current) => ({ ...current, brandColorHex })),
    [updateDraft],
  );

  const setLogoDataUrl = useCallback(
    (logoDataUrl: string | null) =>
      updateDraft((current) => ({ ...current, logoDataUrl })),
    [updateDraft],
  );

  const toggleObjective = useCallback(
    (key: string) =>
      updateDraft((current) => {
        const objectives = new Set(current.objectives);
        if (objectives.has(key)) objectives.delete(key);
        else objectives.add(key);
        return { ...current, objectives };
      }),
    [updateDraft],
  );

  const setMemberCountRange = useCallback(
    (memberCountRange: string | null) =>
      updateDraft((current) => ({ ...current, memberCountRange })),
    [updateDraft],
  );

  const setCity = useCallback(
    (city: string) => updateDraft((current) => ({ ...current, city })),
    [updateDraft],
  );

  const setPostalCode = useCallback(
    (postalCode: string) => updateDraft((current) => ({ ...current, postalCode })),
    [updateDraft],
  );

  const setAddress = useCallback(
    (address: string) => updateDraft((current) => ({ ...current, address })),
    [updateDraft],
  );

  const setPracticeLocations = useCallback(
    (practiceLocations: PracticeLocation[]) =>
      updateDraft((current) => ({ ...current, practiceLocations })),
    [updateDraft],
  );

  const addPracticeLocation = useCallback(
    (location: PracticeLocation) =>
      updateDraft((current) => ({
        ...current,
        practiceLocations: [...current.practiceLocations, location],
      })),
    [updateDraft],
  );

  const removePracticeLocation = useCallback(
    (index: number) =>
      updateDraft((current) => ({
        ...current,
        practiceLocations: current.practiceLocations.filter(
          (_, locationIndex) => locationIndex !== index,
        ),
      })),
    [updateDraft],
  );

  const replaceDraft = useCallback((nextDraft: ClubSetupDraft) => {
    setDraft(nextDraft);
  }, []);

  const resetAndClear = useCallback(() => {
    if (userId) clearDraftStorage(userId);
    setDraft(createEmptyClubSetupDraft());
    setHadPersistedDraft(false);
  }, [userId]);

  return {
    draft,
    isReady,
    hadPersistedDraft,
    setCurrentStep,
    setName,
    setSport,
    setDescription,
    setBrandColorHex,
    setLogoDataUrl,
    toggleObjective,
    setMemberCountRange,
    setCity,
    setPostalCode,
    setAddress,
    setPracticeLocations,
    addPracticeLocation,
    removePracticeLocation,
    replaceDraft,
    resetAndClear,
    persistImmediately,
  };
}
