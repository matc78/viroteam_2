"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
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
import {
  addressLineError,
  cityError,
  postalCodeError,
} from "@/lib/format/personDataFormat";
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
  const {
    draft,
    isReady,
    hadPersistedDraft,
    setPracticeLocations,
    setUseClubAddressAsFirstLocation,
  } = draftApi;

  const [currentStep, setCurrentStep] = useState<number>(
    ClubSetupSteps.prerequisites,
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const trackedStartRef = useRef(false);

  useEffect(() => {
    trackedStartRef.current = false;
  }, [userId]);

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

  const buildHeadquartersLocation = useCallback(() => {
    if (!draft.city.trim() && !draft.address.trim()) return null;
    return ClubSetupFormat.headquartersPracticeLocation({
      sport: draft.sport,
      address: draft.address,
      postalCode: draft.postalCode,
      city: draft.city,
    });
  }, [draft.address, draft.city, draft.postalCode, draft.sport]);

  const withoutHeadquartersLocations = useCallback(
    (locations: PracticeLocation[]) =>
      locations.filter((location) => !location.linkedToHeadquarters),
    [],
  );

  const resolvePracticeLocations = useCallback(() => {
    const locations = withoutHeadquartersLocations(draft.practiceLocations);
    if (!draft.useClubAddressAsFirstLocation) return locations;

    const clubAddressLocation = buildHeadquartersLocation();
    if (!clubAddressLocation) return locations;
    return [clubAddressLocation, ...locations];
  }, [
    buildHeadquartersLocation,
    draft.practiceLocations,
    draft.useClubAddressAsFirstLocation,
    withoutHeadquartersLocations,
  ]);

  const canProceedLocation = useCallback(() => {
    const locations = resolvePracticeLocations();
    if (cityError(draft.city, { required: true })) return false;
    if (postalCodeError(draft.postalCode)) return false;
    if (addressLineError(draft.address)) return false;
    if (locations.length === 0) return false;
    for (const location of locations) {
      if (location.city && cityError(location.city)) return false;
      if (location.address && addressLineError(location.address)) return false;
    }
    return true;
  }, [
    draft.address,
    draft.city,
    draft.postalCode,
    resolvePracticeLocations,
  ]);

  const upsertClubHeadquartersLocation = useCallback(
    (showErrorIfEmpty: boolean) => {
      const clubAddressLocation = buildHeadquartersLocation();
      if (!clubAddressLocation) {
        if (showErrorIfEmpty) {
          setErrorMessage("Renseignez d'abord la ville du club.");
        }
        return false;
      }

      const otherLocations = withoutHeadquartersLocations(
        draft.practiceLocations,
      );
      const nextLocations = [clubAddressLocation, ...otherLocations];
      if (
        ClubSetupFormat.areSameLocations(
          draft.practiceLocations,
          nextLocations,
        )
      ) {
        return true;
      }

      setPracticeLocations(nextLocations);
      return true;
    },
    [
      buildHeadquartersLocation,
      draft.practiceLocations,
      setPracticeLocations,
      withoutHeadquartersLocations,
    ],
  );

  const removeClubHeadquartersAsLocation = useCallback(() => {
    const nextLocations = withoutHeadquartersLocations(
      draft.practiceLocations,
    );
    if (
      ClubSetupFormat.areSameLocations(
        draft.practiceLocations,
        nextLocations,
      )
    ) {
      return;
    }
    setPracticeLocations(nextLocations);
  }, [
    draft.practiceLocations,
    setPracticeLocations,
    withoutHeadquartersLocations,
  ]);

  useEffect(() => {
    if (!isReady || !draft.useClubAddressAsFirstLocation) return;
    const updated = upsertClubHeadquartersLocation(false);
    if (!updated) {
      removeClubHeadquartersAsLocation();
    }
  }, [
    draft.address,
    draft.city,
    draft.postalCode,
    draft.sport,
    draft.useClubAddressAsFirstLocation,
    isReady,
    removeClubHeadquartersAsLocation,
    upsertClubHeadquartersLocation,
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
          setErrorMessage(
            cityError(draft.city, { required: true }) ??
              postalCodeError(draft.postalCode) ??
              addressLineError(draft.address) ??
              "Ville et au moins un lieu de pratique requis.",
          );
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
    draftApi.setCurrentStep(step);
    draftApi.persistImmediately();
    ClubSetupAnalytics.trackStepViewed(step);
  }

  function handleStepSelect(step: number) {
    if (step === currentStep) return;
    if (step > draft.maxReachedStep) return;
    if (step > currentStep && !validateCurrentStep()) return;
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

    if (draft.useClubAddressAsFirstLocation) {
      upsertClubHeadquartersLocation(false);
    }

    if (!canProceedIdentity(draft)) {
      setErrorMessage("Nom du club et sport requis.");
      return;
    }
    if (!canProceedObjectives(draft)) {
      setErrorMessage("Sélectionnez au moins un objectif.");
      return;
    }
    if (
      !canProceedInfo({
        ...draft,
        practiceLocations: resolvePracticeLocations(),
      })
    ) {
      setErrorMessage(
        cityError(draft.city, { required: true }) ??
          postalCodeError(draft.postalCode) ??
          addressLineError(draft.address) ??
          "Ville et au moins un lieu de pratique requis.",
      );
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
      Sentry.captureException(error, {
        tags: { feature: "club_setup", area: "create_club" },
        extra: {
          step: currentStep,
          sport: draft.sport,
          founderUid: userId,
        },
      });
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
            onSportChange={draftApi.setSport}
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
            sport={draft.sport}
            locations={draft.practiceLocations}
            useClubAddressAsFirstLocation={draft.useClubAddressAsFirstLocation}
            onCityChange={draftApi.setCity}
            onPostalCodeChange={draftApi.setPostalCode}
            onAddressChange={draftApi.setAddress}
            onUseClubAddressChanged={handleUseClubAddressChanged}
            onAddLocation={draftApi.addPracticeLocation}
            onRemoveLocation={(index) => {
              const removed = draft.practiceLocations[index];
              if (removed?.linkedToHeadquarters) {
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
    currentStep === ClubSetupSteps.location ||
    currentStep === ClubSetupSteps.recap;

  return (
    <ClubSetupShell
      eyebrow={stepIntro.eyebrow}
      title={stepIntro.title}
      lead={stepIntro.lead}
      currentStep={currentStep}
      maxReachedStep={draft.maxReachedStep}
      stepKey={String(currentStep)}
      previewBanner={previewMode}
      resumeBanner={showResumeBanner}
      errorMessage={errorMessage}
      onStepSelect={handleStepSelect}
      nextLabel={submitting ? "Création…" : nextLabel}
      canProceed={canProceed}
      submitting={submitting}
      onNext={() => void handleNext()}
      onCreateClick={
        currentStep === ClubSetupSteps.recap
          ? () => void handleNext()
          : undefined
      }
      compactBody={currentStep === ClubSetupSteps.prerequisites}
      wideLayout={wideLayout}
    >
      {stepContent}
    </ClubSetupShell>
  );
}
