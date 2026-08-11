/** Statuts de cotisation alignés sur le modèle métier. */
export type FeeStatus = "paye" | "partiel" | "a_payer";

/** KPI affiché en bandeau sur la home admin. */
export type HomeKpi = {
  id: string;
  label: string;
  value: number;
  hint: string;
  tone: "neutral" | "warning" | "success" | "accent";
};

/** Segment du donut cotisations. */
export type FeeStatusSegment = {
  status: FeeStatus;
  label: string;
  count: number;
  color: string;
};

/** Point mensuel d’encaissements (CB vs hors-ligne). */
export type CollectionMonth = {
  month: string;
  cardAmount: number;
  offlineAmount: number;
};

/** Événement à venir (lecture seule). */
export type UpcomingEvent = {
  id: string;
  title: string;
  team: string;
  startsAt: string;
  location: string;
  rsvpYes: number;
  rsvpTotal: number;
};

/** Alerte bureau à traiter. */
export type AttentionItem = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
};

/** Jeu de données mock de la home dashboard admin. */
export type MockHomeData = {
  clubName: string;
  seasonLabel: string;
  adminDisplayName: string;
  kpis: HomeKpi[];
  feeStatus: FeeStatusSegment[];
  collections: CollectionMonth[];
  upcomingEvents: UpcomingEvent[];
  attentionItems: AttentionItem[];
};

/** Données mock home admin — à remplacer par Firestore plus tard. */
export const mockHomeData: MockHomeData = {
  clubName: "FC Example",
  seasonLabel: "Saison 2025-2026",
  adminDisplayName: "Alex",
  kpis: [
    {
      id: "members",
      label: "Membres actifs",
      value: 148,
      hint: "Joueurs, coachs, admins",
      tone: "neutral",
    },
    {
      id: "due",
      label: "À payer",
      value: 42,
      hint: "Cotisations ouvertes",
      tone: "warning",
    },
    {
      id: "paid",
      label: "Payées",
      value: 89,
      hint: "Soldées cette saison",
      tone: "success",
    },
    {
      id: "aids",
      label: "Aides en attente",
      value: 7,
      hint: "Justificatifs à valider",
      tone: "accent",
    },
  ],
  feeStatus: [
    {
      status: "paye",
      label: "Payé",
      count: 89,
      color: "#22c55e",
    },
    {
      status: "partiel",
      label: "Partiel",
      count: 17,
      color: "#facc15",
    },
    {
      status: "a_payer",
      label: "À payer",
      count: 42,
      color: "#ff6b2c",
    },
  ],
  collections: [
    { month: "Sep", cardAmount: 4200, offlineAmount: 1100 },
    { month: "Oct", cardAmount: 6800, offlineAmount: 900 },
    { month: "Nov", cardAmount: 5100, offlineAmount: 1400 },
    { month: "Déc", cardAmount: 3900, offlineAmount: 800 },
    { month: "Jan", cardAmount: 7200, offlineAmount: 1600 },
    { month: "Fév", cardAmount: 5800, offlineAmount: 1200 },
  ],
  upcomingEvents: [
    {
      id: "evt-1",
      title: "Entraînement U14",
      team: "U14 A",
      startsAt: "2026-03-12T18:30:00",
      location: "Terrain annexe",
      rsvpYes: 14,
      rsvpTotal: 18,
    },
    {
      id: "evt-2",
      title: "Match amical",
      team: "Seniors",
      startsAt: "2026-03-14T15:00:00",
      location: "Stade municipal",
      rsvpYes: 11,
      rsvpTotal: 16,
    },
    {
      id: "evt-3",
      title: "Réunion parents",
      team: "U12",
      startsAt: "2026-03-16T19:00:00",
      location: "Club-house",
      rsvpYes: 22,
      rsvpTotal: 28,
    },
    {
      id: "evt-4",
      title: "Entraînement gardien",
      team: "U16",
      startsAt: "2026-03-18T17:45:00",
      location: "Gymnase",
      rsvpYes: 4,
      rsvpTotal: 6,
    },
  ],
  attentionItems: [
    {
      id: "att-1",
      severity: "high",
      title: "12 cotisations en retard",
      detail: "Échéance dépassée de plus de 14 jours",
    },
    {
      id: "att-2",
      severity: "high",
      title: "7 aides à valider",
      detail: "Justificatifs en attente de revue",
    },
    {
      id: "att-3",
      severity: "medium",
      title: "RSVP faible — Match U16",
      detail: "6 réponses sur 18 joueurs",
    },
    {
      id: "att-4",
      severity: "low",
      title: "3 invitations expirées",
      detail: "À renvoyer ou annuler",
    },
  ],
};
