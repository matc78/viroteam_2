"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { IdentityStep } from "@/components/clubSetup/steps/IdentityStep";
import { LocationStep } from "@/components/clubSetup/steps/LocationStep";
import { ObjectivesStep } from "@/components/clubSetup/steps/ObjectivesStep";
import { PrerequisitesStep } from "@/components/clubSetup/steps/PrerequisitesStep";
import { RecapStep } from "@/components/clubSetup/steps/RecapStep";
import {
  ClubSetupLoadingShell,
  ClubSetupShell,
} from "@/components/clubSetup/ClubSetupShell";
import { useToast } from "@/components/ToastProvider";
import { clearSignupIntent } from "@/lib/auth/signupIntent";
import { ClubSetupAnalytics } from "@/lib/clubSetup/clubSetupAnalytics";
import { createClubFromDraft } from "@/lib/clubSetup/clubSetupService";
import { ClubSetupSteps } from "@/lib/clubSetup/constants";
import { ClubSetupFormat } from "@/lib/clubSetup/clubSetupFormat";
import {
  canProceedIdentity,
  canProceedInfo,
  canProceedObjectives,
  hasSavedProgress,
  type PracticeLocation,
} from "@/lib/clubSetup/clubSetupDraft";
import { useClubSetupDraft } from "@/lib/clubSetup/useClubSetupDraft";
import { isClubSetupPreviewEnabled } from "@/lib/clubSetup/clubSetupPreview";
import { clubSetupStepIntro } from "@/lib/clubSetup/clubSetupStepIntro";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { ACTIVE_CLUB_STORAGE_KEY } from "@/lib/firebase/constants";

/** Orchestrateur wizard création club (5 étapes). */
export function ClubSetupWizard() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, profile, refreshProfile, status } = useAuth();
  const userId = user?.uid ?? null;
  const previewMode =
    isClubSetupPreviewEnabled() && status !== "signedIn";

  const draftApi = useClubSetupDraft(userId);
  const { draft, isReady, hadPersistedDraft } = draftApi;

  const [currentStep, setCurrentStep] = useState<number>(ClubSetupSteps.prerequisites);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [useClubAddressAsFirstLocation, setUseClubAddressAsFirstLocation] =
    useState(false);
  const headquartersLocationRef = useRef<PracticeLocation | null>(null);
  const trackedStartRef = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    setCurrentStep(draft.currentStep);
  }, [isReady, draft.currentStep]);

  useEffect(() => {
    if (!isReady || trackedStartRef.current) return;
    trackedStartRef.current = true;
    ClubSetupAnalytics.trackStarted({
      resumed: hadPersistedDraft,
      initialStep: draft.currentStep,
    });
    ClubSetupAnalytics.trackStepViewed(draft.currentStep);
  }, [draft.currentStep, hadPersistedDraft, isReady]);

  useEffect(() => {
    if (!isReady || !hadPersistedDraft) return;
    const headquartersIndex = ClubSetupFormat.headquartersLocationIndex({
      address: draft.address,
      postalCode: draft.postalCode,
      city: draft.city,
      sport: draft.sport,
      locations: draft.practiceLocations,
    });
    if (headquartersIndex >= 0) {
      setUseClubAddressAsFirstLocation(true);
      headquartersLocationRef.current = draft.practiceLocations[headquartersIndex];
    }
  }, [draft, hadPersistedDraft, isReady]);

  const persistStep = useCallback(
    (step: number) => {
      draftApi.setCurrentStep(step);
      draftApi.persistImmediately();
    },
    [draftApi],
  );

  const buildHeadquartersLocation = useCallback(() => {
    if (!draft.city.trim() && !draft.address.trim()) return null;
    return ClubSetupFormat.headquartersPracticeLocation({
      sport: draft.sport,
      address: draft.address,
      postalCode: draft.postalCode,
      city: draft.city,
    });
  }, [draft.address, draft.city, draft.postalCode, draft.sport]);

  const resolvePracticeLocations = useCallback(() => {
    let locations = [...draft.practiceLocations];
    if (!useClubAddressAsFirstLocation) return locations;

    const clubAddressLocation = buildHeadquartersLocation();
    if (!clubAddressLocation) return locations;

    const previousLocation = headquartersLocationRef.current;
    if (previousLocation) {
      locations = locations.filter(
        (location) => !ClubSetupFormat.isSameLocation(location, previousLocation),
      );
    }
    const alreadyPresent = locations.some((location) =>
      ClubSetupFormat.isSameLocation(location, clubAddressLocation),
    );
    if (!alreadyPresent) {
      locations = [clubAddressLocation, ...locations];
    }
    return locations;
  }, [buildHeadquartersLocation, draft.practiceLocations, useClubAddressAsFirstLocation]);

  const canProceedLocation = useCallback(() => {
    const locations = resolvePracticeLocations();
    return draft.city.trim().length > 0 && locations.length > 0;
  }, [draft.city, resolvePracticeLocations]);

  const upsertClubHeadquartersLocation = useCallback(
    (showErrorIfEmpty: boolean) => {
      const clubAddressLocation = buildHeadquartersLocation();
      if (!clubAddressLocation) {
        if (showErrorIfEmpty) {
          setErrorMessage("Renseignez d'abord la ville du club.");
        }
        return false;
      }

      const previousLocation = headquartersLocationRef.current;
      if (
        previousLocation &&
        ClubSetupFormat.isSameLocation(previousLocation, clubAddressLocation)
      ) {
        return true;
      }

      let locations = [...draft.practiceLocations];
      if (previousLocation) {
        locations = locations.filter(
          (location) => !ClubSetupFormat.isSameLocation(location, previousLocation),
        );
      }
      const alreadyPresent = locations.some((location) =>
        ClubSetupFormat.isSameLocation(location, clubAddressLocation),
      );
      if (!alreadyPresent) {
        locations = [clubAddressLocation, ...locations];
      }
      draftApi.setPracticeLocations(locations);
      headquartersLocationRef.current = clubAddressLocation;
      return true;
    },
    [buildHeadquartersLocation, draft.practiceLocations, draftApi],
  );

  const removeClubHeadquartersAsLocation = useCallback(() => {
    const clubAddressLocation = headquartersLocationRef.current;
    if (!clubAddressLocation) return;
    draftApi.setPracticeLocations(
      draft.practiceLocations.filter(
        (location) => !ClubSetupFormat.isSameLocation(location, clubAddressLocation),
      ),
    );
    headquartersLocationRef.current = null;
  }, [draft.practiceLocations, draftApi]);

  const syncClubHeadquartersLocation = useCallback(() => {
    if (!useClubAddressAsFirstLocation) return;
    const updated = upsertClubHeadquartersLocation(false);
    if (!updated) {
      removeClubHeadquartersAsLocation();
      setUseClubAddressAsFirstLocation(false);
    }
  }, [
    removeClubHeadquartersAsLocation,
    upsertClubHeadquartersLocation,
    useClubAddressAsFirstLocation,
  ]);

  function handleUseClubAddressChanged(useClubAddress: boolean) {
    if (useClubAddress) {
      const added = upsertClubHeadquartersLocation(true);
      setUseClubAddressAsFirstLocation(added);
      return;
    }
    removeClubHeadquartersAsLocation();
    setUseClubAddressAsFirstLocation(false);
  }

  function validateCurrentStep(): boolean {
    setErrorMessage(null);
    switch (currentStep) {
      case ClubSetupSteps.identity:
        if (!canProceedIdentity(draft)) {
          setErrorMessage("Nom du club (2 caractères min.) et sport requis.");
          return false;
        }
        return true;
      case ClubSetupSteps.objectives:
        if (!canProceedObjectives(draft)) {
          setErrorMessage("Sélectionnez au moins un objectif.");
          return false;
        }
        return true;
      case ClubSetupSteps.location:
        if (!canProceedLocation()) {
          setErrorMessage("Ville et au moins un lieu de pratique requis.");
          return false;
        }
        upsertClubHeadquartersLocation(false);
        return true;
      default:
        return true;
    }
  }

  function goToStep(step: number) {
    setCurrentStep(step);
    persistStep(step);
    ClubSetupAnalytics.trackStepViewed(step);
  }

  function handleStepSelect(step: number) {
    if (step >= currentStep) return;
    setErrorMessage(null);
    goToStep(step);
  }

  async function handleNext() {
    if (currentStep === ClubSetupSteps.recap) {
      if (previewMode) {
        showToast("Mode aperçu local — aucun club n’a été créé.", "info");
        return;
      }
      await handleSubmit();
      return;
    }
    if (!validateCurrentStep()) return;
    goToStep(currentStep + 1);
  }

  async function handleSubmit() {
    setErrorMessage(null);

    if (previewMode) {
      showToast("Mode aperçu local — aucun club n’a été créé.", "info");
      return;
    }

    syncClubHeadquartersLocation();

    if (!canProceedIdentity(draft)) {
      setErrorMessage("Nom du club et sport requis.");
      return;
    }
    if (!canProceedObjectives(draft)) {
      setErrorMessage("Sélectionnez au moins un objectif.");
      return;
    }
    if (!canProceedInfo({ ...draft, practiceLocations: resolvePracticeLocations() })) {
      setErrorMessage("Ville et au moins un lieu de pratique requis.");
      return;
    }
    if (!userId || !profile) {
      setErrorMessage(
        "Profil introuvable. Reconnectez-vous ou vérifiez votre connexion.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const clubId = await createClubFromDraft({
        founderUid: userId,
        founder: profile,
        draft: {
          ...draft,
          practiceLocations: resolvePracticeLocations(),
        },
      });
      ClubSetupAnalytics.trackCompleted({
        sport: draft.sport,
        objectives: draft.objectives,
        memberCountRange: draft.memberCountRange,
      });
      draftApi.resetAndClear();
      clearSignupIntent();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ACTIVE_CLUB_STORAGE_KEY, clubId);
      }
      await refreshProfile();
      showToast("Club créé avec succès.", "success");
      router.replace("/home");
    } catch (error) {
      setErrorMessage(`Erreur lors de la création : ${error}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isReady) {
    return <ClubSetupLoadingShell />;
  }

  const nextLabel =
    currentStep === ClubSetupSteps.prerequisites
      ? "C'est parti"
      : currentStep === ClubSetupSteps.recap
        ? previewMode
          ? "Fin de l’aperçu"
          : "Créer le club"
        : "Continuer";

  const canProceed =
    currentStep === ClubSetupSteps.identity
      ? canProceedIdentity(draft)
      : currentStep === ClubSetupSteps.objectives
        ? canProceedObjectives(draft)
        : currentStep === ClubSetupSteps.location
          ? canProceedLocation()
          : true;

  const showResumeBanner =
    hadPersistedDraft &&
    hasSavedProgress(draft) &&
    currentStep === ClubSetupSteps.prerequisites;

  const stepContent = (() => {
    switch (currentStep) {
      case ClubSetupSteps.prerequisites:
        return <PrerequisitesStep />;
      case ClubSetupSteps.identity:
        return (
          <IdentityStep
            draft={draft}
            onNameChange={draftApi.setName}
            onSportChange={(sport) => {
              draftApi.setSport(sport);
              syncClubHeadquartersLocation();
            }}
            onLogoChange={draftApi.setLogoDataUrl}
          />
        );
      case ClubSetupSteps.objectives:
        return (
          <ObjectivesStep
            selected={draft.objectives}
            memberCountRange={draft.memberCountRange}
            onToggle={draftApi.toggleObjective}
            onMemberCountChanged={draftApi.setMemberCountRange}
          />
        );
      case ClubSetupSteps.location:
        return (
          <LocationStep
            city={draft.city}
            postalCode={draft.postalCode}
            address={draft.address}
            locations={draft.practiceLocations}
            useClubAddressAsFirstLocation={useClubAddressAsFirstLocation}
            onCityChange={(city) => {
              draftApi.setCity(city);
              syncClubHeadquartersLocation();
            }}
            onPostalCodeChange={(postalCode) => {
              draftApi.setPostalCode(postalCode);
              syncClubHeadquartersLocation();
            }}
            onAddressChange={(address) => {
              draftApi.setAddress(address);
              syncClubHeadquartersLocation();
            }}
            onUseClubAddressChanged={handleUseClubAddressChanged}
            onAddLocation={draftApi.addPracticeLocation}
            onRemoveLocation={(index) => {
              const removed = draft.practiceLocations[index];
              if (
                headquartersLocationRef.current &&
                removed &&
                ClubSetupFormat.isSameLocation(removed, headquartersLocationRef.current)
              ) {
                headquartersLocationRef.current = null;
                setUseClubAddressAsFirstLocation(false);
              }
              draftApi.removePracticeLocation(index);
            }}
          />
        );
      case ClubSetupSteps.recap:
        return <RecapStep draft={draft} />;
      default:
        return null;
    }
  })();

  const stepIntro = clubSetupStepIntro(currentStep);
  const wideLayout =
    currentStep === ClubSetupSteps.identity ||
    currentStep === ClubSetupSteps.objectives ||
    currentStep === ClubSetupSteps.location;

  return (
    <ClubSetupShell
      eyebrow={stepIntro.eyebrow}
      title={stepIntro.title}
      lead={stepIntro.lead}
      currentStep={currentStep}
      stepKey={String(currentStep)}
      previewBanner={previewMode}
      resumeBanner={showResumeBanner}
      errorMessage={errorMessage}
      onStepSelect={handleStepSelect}
      nextLabel={submitting ? "Création…" : nextLabel}
      canProceed={canProceed}
      submitting={submitting}
      onNext={() => void handleNext()}
      compactBody={currentStep === ClubSetupSteps.prerequisites}
      wideLayout={wideLayout}
    >
      {stepContent}
    </ClubSetupShell>
  );
}
