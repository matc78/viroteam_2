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

/** Catégories de lieux de pratique (wizard + persistance). */
export const PracticeLocationCategories = {
  cityStade: "city_stade",
  stadium: "stadium",
  gymnasium: "gymnasium",
  athleticsTrack: "athletics_track",
  healthTrail: "health_trail",
  forest: "forest",
  lake: "lake",
  pool: "pool",
  dojo: "dojo",
  tennisCourt: "tennis_court",
  fencingHall: "fencing_hall",
  nauticalBase: "nautical_base",
  other: "other",
  all: [
    "city_stade",
    "stadium",
    "gymnasium",
    "athletics_track",
    "health_trail",
    "forest",
    "lake",
    "pool",
    "dojo",
    "tennis_court",
    "fencing_hall",
    "nautical_base",
    "other",
  ] as const,
  labels: {
    city_stade: "City-stade",
    stadium: "Stade",
    gymnasium: "Gymnase",
    athletics_track: "Piste d'athlétisme",
    health_trail: "Parcours santé",
    forest: "Forêt",
    lake: "Lac",
    pool: "Piscine",
    dojo: "Dojo",
    tennis_court: "Court de tennis",
    fencing_hall: "Salle d'armes",
    nautical_base: "Base nautique",
    other: "Autre",
  } as const,
  /** Catégories proposées selon le sport du club (+ Autre toujours). */
  forSport(sport: string): readonly string[] {
    const withOther = (categories: string[]) => [
      ...categories,
      PracticeLocationCategories.other,
    ];
    switch (sport) {
      case "Football":
      case "Rugby":
        return withOther([
          PracticeLocationCategories.stadium,
          PracticeLocationCategories.cityStade,
          PracticeLocationCategories.gymnasium,
          PracticeLocationCategories.forest,
          PracticeLocationCategories.healthTrail,
        ]);
      case "Basketball":
      case "Handball":
      case "Volleyball":
        return withOther([
          PracticeLocationCategories.cityStade,
          PracticeLocationCategories.gymnasium,
          PracticeLocationCategories.stadium,
          PracticeLocationCategories.forest,
          PracticeLocationCategories.healthTrail,
        ]);
      case "Athlétisme":
        return withOther([
          PracticeLocationCategories.athleticsTrack,
          PracticeLocationCategories.stadium,
          PracticeLocationCategories.healthTrail,
          PracticeLocationCategories.forest,
        ]);
      case "Natation":
        return withOther([
          PracticeLocationCategories.pool,
          PracticeLocationCategories.lake,
        ]);
      case "Tennis":
        return withOther([
          PracticeLocationCategories.tennisCourt,
          PracticeLocationCategories.gymnasium,
        ]);
      case "Judo":
        return withOther([
          PracticeLocationCategories.dojo,
          PracticeLocationCategories.gymnasium,
        ]);
      case "Escrime":
        return withOther([
          PracticeLocationCategories.fencingHall,
          PracticeLocationCategories.gymnasium,
        ]);
      case "Aviron":
        return withOther([
          PracticeLocationCategories.nauticalBase,
          PracticeLocationCategories.lake,
        ]);
      default:
        return PracticeLocationCategories.all;
    }
  },
  /** Catégorie proposée selon le sport du club. */
  defaultForSport(sport: string): string {
    return PracticeLocationCategories.forSport(sport)[0] ?? PracticeLocationCategories.other;
  },
  label(category: string, customLabel?: string): string {
    if (
      category === PracticeLocationCategories.other &&
      customLabel?.trim()
    ) {
      return customLabel.trim();
    }
    return (
      PracticeLocationCategories.labels[
        category as keyof typeof PracticeLocationCategories.labels
      ] ?? customLabel?.trim() ?? PracticeLocationCategories.labels.other
    );
  },
  isKnown(category: string): boolean {
    return (PracticeLocationCategories.all as readonly string[]).includes(
      category,
    );
  },
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

/** Tailles d’effectif proposées à l’onboarding (10→100 puis +25). */
function buildClubMemberCountValues(): readonly string[] {
  const values: string[] = [];
  for (let count = 10; count <= 100; count += 10) {
    values.push(String(count));
  }
  for (let count = 125; count <= 1000; count += 25) {
    values.push(String(count));
  }
  return values;
}

const CLUB_MEMBER_COUNT_VALUES = buildClubMemberCountValues();

export const ClubMemberCountRanges = {
  /** Anciennes fourchettes (brouillons / analytics historiques). */
  under30: "under_30",
  range30to100: "30_100",
  range100to300: "100_300",
  over300: "over_300",
  all: CLUB_MEMBER_COUNT_VALUES,
  label(key: string): string {
    if (/^\d+$/.test(key)) return key;
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
    if (/^\d+$/.test(key)) {
      return `${key} membres`;
    }
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
  /**
   * Mappe une ancienne fourchette vers une valeur numérique du carrousel.
   * Les valeurs déjà numériques sont conservées.
   */
  migratePersisted(value: string | null | undefined): string | null {
    if (value == null || value === "") return null;
    if (/^\d+$/.test(value)) return value;
    switch (value) {
      case ClubMemberCountRanges.under30:
        return "20";
      case ClubMemberCountRanges.range30to100:
        return "50";
      case ClubMemberCountRanges.range100to300:
        return "200";
      case ClubMemberCountRanges.over300:
        return "300";
      default:
        return value;
    }
  },
} as const;

export const CLUB_SETUP_DRAFT_KEY_PREFIX = "club_setup_draft_v1_";
export const CLUB_SETUP_LOGO_KEY_PREFIX = "club_setup_logo_v1_";
