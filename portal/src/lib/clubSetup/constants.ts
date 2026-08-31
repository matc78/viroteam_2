/** Indices et libellés du wizard création club (aligné ClubSetupSteps Flutter). */
export const ClubSetupSteps = {
  wizardVersion: 2,
  prerequisites: 0,
  identity: 1,
  objectives: 2,
  location: 3,
  recap: 4,
  total: 5,
  labels: [
    "Prérequis",
    "Identité",
    "Objectifs",
    "Localisation",
    "Récap",
  ] as const,
  analyticsKeys: [
    "prerequisites",
    "identity",
    "objectives",
    "location",
    "recap",
  ] as const,
  clampIndex(step: number): number {
    if (step < 0) return 0;
    if (step >= ClubSetupSteps.total) return ClubSetupSteps.total - 1;
    return step;
  },
  analyticsKey(step: number): string {
    return ClubSetupSteps.analyticsKeys[ClubSetupSteps.clampIndex(step)];
  },
  normalizePersistedStep(step: number, wizardVersion: number): number {
    const clamped = Math.min(
      Math.max(step, 0),
      ClubSetupSteps.total - 1,
    );
    if (wizardVersion >= ClubSetupSteps.wizardVersion) return clamped;
    if (step <= ClubSetupSteps.prerequisites) return ClubSetupSteps.prerequisites;
    if (step === 1) return ClubSetupSteps.identity;
    return Math.min(Math.max(step - 1, ClubSetupSteps.identity), ClubSetupSteps.recap);
  },
} as const;

export const ClubSetupDefaults = {
  brandColorHex: "#134A7D",
} as const;

export const ClubSports = {
  all: [
    "Football",
    "Basketball",
    "Volleyball",
    "Handball",
    "Rugby",
    "Tennis",
    "Natation",
    "Athlétisme",
    "Judo",
    "Escrime",
    "Aviron",
    "Autre",
  ] as const,
} as const;

export const ClubObjectives = {
  planning: "planning",
  attendance: "attendance",
  fees: "fees",
  equipment: "equipment",
  communication: "communication",
  members: "members",
  teams: "teams",
  documents: "documents",
  parents: "parents",
  stats: "stats",
  all: [
    "planning",
    "attendance",
    "fees",
    "equipment",
    "communication",
    "members",
    "teams",
    "documents",
    "parents",
    "stats",
  ] as const,
  label(key: string): string {
    switch (key) {
      case ClubObjectives.planning:
        return "Planning & événements";
      case ClubObjectives.attendance:
        return "Présences";
      case ClubObjectives.fees:
        return "Cotisations";
      case ClubObjectives.equipment:
        return "Équipement";
      case ClubObjectives.communication:
        return "Annonces";
      case ClubObjectives.members:
        return "Gestion des membres";
      case ClubObjectives.teams:
        return "Équipes & catégories";
      case ClubObjectives.documents:
        return "Documents";
      case ClubObjectives.parents:
        return "Espace parents";
      case ClubObjectives.stats:
        return "Statistiques";
      default:
        return key;
    }
  },
} as const;

export const ClubMemberCountRanges = {
  under30: "under_30",
  range30to100: "30_100",
  range100to300: "100_300",
  over300: "over_300",
  all: ["under_30", "30_100", "100_300", "over_300"] as const,
  label(key: string): string {
    switch (key) {
      case ClubMemberCountRanges.under30:
        return "< 30";
      case ClubMemberCountRanges.range30to100:
        return "30 – 100";
      case ClubMemberCountRanges.range100to300:
        return "100 – 300";
      case ClubMemberCountRanges.over300:
        return "300+";
      default:
        return key;
    }
  },
  recapLabel(key: string): string {
    switch (key) {
      case ClubMemberCountRanges.under30:
        return "Moins de 30 membres";
      case ClubMemberCountRanges.range30to100:
        return "30 à 100 membres";
      case ClubMemberCountRanges.range100to300:
        return "100 à 300 membres";
      case ClubMemberCountRanges.over300:
        return "Plus de 300 membres";
      default:
        return ClubMemberCountRanges.label(key);
    }
  },
} as const;

export const CLUB_SETUP_DRAFT_KEY_PREFIX = "club_setup_draft_v1_";
export const CLUB_SETUP_LOGO_KEY_PREFIX = "club_setup_logo_v1_";
