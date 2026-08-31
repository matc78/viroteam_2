import { ClubSetupSteps } from "./constants";
import { posthog } from "@/lib/posthog";

const STARTED_EVENT = "club_setup_started";
const STEP_VIEWED_EVENT = "club_setup_step_viewed";
const COMPLETED_EVENT = "club_setup_completed";

/** Événements PostHog du wizard création de club. */
export const ClubSetupAnalytics = {
  trackStarted(params: { resumed: boolean; initialStep: number }): void {
    posthog.capture(STARTED_EVENT, {
      wizard_version: ClubSetupSteps.wizardVersion,
      resumed: params.resumed,
      initial_step: ClubSetupSteps.analyticsKey(params.initialStep),
    });
  },

  trackStepViewed(step: number): void {
    const stepIndex = ClubSetupSteps.clampIndex(step);
    posthog.capture(STEP_VIEWED_EVENT, {
      wizard_version: ClubSetupSteps.wizardVersion,
      step: ClubSetupSteps.analyticsKey(stepIndex),
      step_index: stepIndex,
    });
  },

  trackCompleted(params: {
    sport: string;
    objectives: Set<string>;
    memberCountRange?: string | null;
  }): void {
    const sortedObjectives = [...params.objectives].sort();
    posthog.capture(COMPLETED_EVENT, {
      wizard_version: ClubSetupSteps.wizardVersion,
      sport: params.sport,
      objectives: sortedObjectives,
      objective_count: sortedObjectives.length,
      ...(params.memberCountRange
        ? { member_count_range: params.memberCountRange }
        : {}),
    });
  },
};
