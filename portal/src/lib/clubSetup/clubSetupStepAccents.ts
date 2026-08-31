import { ClubSetupSteps } from "@/lib/clubSetup/constants";

const PROGRESS_ICON_BASE = "/club-setup/progress";

/** Accent cadre + icône par étape du wizard. */
export const ClubSetupStepAccents = [
  {
    step: ClubSetupSteps.prerequisites,
    color: "var(--color-error)",
    label: "Prérequis",
  },
  {
    step: ClubSetupSteps.identity,
    color: "var(--color-primary-600)",
    label: "Identité",
  },
  {
    step: ClubSetupSteps.objectives,
    color: "var(--color-sport-cyan)",
    label: "Objectifs",
  },
  {
    step: ClubSetupSteps.location,
    color: "var(--color-sport-green)",
    label: "Localisation",
  },
  {
    step: ClubSetupSteps.recap,
    color: "var(--color-sport-orange)",
    label: "Récap",
  },
] as const;

/** Icônes sportives du fil de progression (6 pictos volley). */
export const ClubSetupProgressIcons = [
  {
    id: "serve",
    src: `${PROGRESS_ICON_BASE}/serve.png`,
    title: "Coup d’envoi",
    stepIndex: ClubSetupSteps.prerequisites,
    accent: "var(--color-error)",
  },
  {
    id: "set",
    src: `${PROGRESS_ICON_BASE}/set.png`,
    title: "Identité",
    stepIndex: ClubSetupSteps.identity,
    accent: "var(--color-primary-600)",
  },
  {
    id: "spike",
    src: `${PROGRESS_ICON_BASE}/spike.png`,
    title: "Priorités",
    stepIndex: ClubSetupSteps.objectives,
    accent: "var(--color-sport-cyan)",
  },
  {
    id: "dive",
    src: `${PROGRESS_ICON_BASE}/dive.png`,
    title: "Localisation",
    stepIndex: ClubSetupSteps.location,
    accent: "var(--color-sport-green)",
  },
  {
    id: "bump",
    src: `${PROGRESS_ICON_BASE}/bump.png`,
    title: "Vérification",
    stepIndex: ClubSetupSteps.recap,
    accent: "var(--color-sport-yellow)",
  },
  {
    id: "celebrate",
    src: `${PROGRESS_ICON_BASE}/celebrate.png`,
    title: "Création",
    stepIndex: ClubSetupSteps.recap,
    accent: "var(--color-sport-orange)",
  },
] as const;

/** Accent du cadre pour l’étape courante. */
export function clubSetupStepAccent(step: number): string {
  const index = ClubSetupSteps.clampIndex(step);
  return ClubSetupStepAccents[index]?.color ?? "var(--color-sport-orange)";
}

/** L’icône est atteinte (étape en cours ou passée). */
export function isClubSetupProgressIconReached(
  currentStep: number,
  iconIndex: number,
): boolean {
  const icon = ClubSetupProgressIcons[iconIndex];
  if (!icon) return false;
  if (iconIndex >= ClubSetupProgressIcons.length - 2) {
    return currentStep >= ClubSetupSteps.recap;
  }
  return currentStep >= icon.stepIndex;
}

/** L’icône correspond à l’étape affichée. */
export function isClubSetupProgressIconCurrent(
  currentStep: number,
  iconIndex: number,
): boolean {
  const icon = ClubSetupProgressIcons[iconIndex];
  if (!icon) return false;
  if (iconIndex === ClubSetupProgressIcons.length - 2) {
    return currentStep === ClubSetupSteps.recap;
  }
  if (iconIndex === ClubSetupProgressIcons.length - 1) {
    return false;
  }
  return currentStep === icon.stepIndex;
}

/** L’icône est validée (étape terminée). */
export function isClubSetupProgressIconCompleted(
  currentStep: number,
  iconIndex: number,
): boolean {
  const icon = ClubSetupProgressIcons[iconIndex];
  if (!icon) return false;
  if (iconIndex >= ClubSetupProgressIcons.length - 2) {
    return false;
  }
  return currentStep > icon.stepIndex;
}

/** L’icône permet de revenir à une étape déjà visitée. */
export function isClubSetupProgressIconNavigable(
  currentStep: number,
  iconIndex: number,
): boolean {
  const icon = ClubSetupProgressIcons[iconIndex];
  if (!icon) return false;
  return icon.stepIndex < currentStep;
}
