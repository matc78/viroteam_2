import { ClubRecord } from "./clubService";
import {
  HOME_PREVIEW_EVENT_LIMIT,
  loadUpcomingEvents,
  type UpcomingEvent,
} from "./eventService";
import { MemberFeeStatuses } from "./constants";
import {
  FeeSeasonRecord,
  getActiveSeason,
  listMemberFees,
  MemberFeeRecord,
} from "./feeService";


type FeeStatus = "paye" | "partiel" | "a_payer" | "exonere";

export type HomeKpi = {
  id: string;
  label: string;
  value: number;
  hint: string;
  tone: "neutral" | "warning" | "success" | "accent";
};

export type FeeStatusSegment = {
  status: FeeStatus;
  label: string;
  count: number;
  color: string;
};

export type CollectionMonth = {
  month: string;
  cardAmount: number;
  offlineAmount: number;
};

export type { UpcomingEvent } from "./eventService";

export type AttentionItem = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
};

/** Données agrégées pour la home dashboard. */
export type HomeDashboardData = {
  clubName: string;
  seasonLabel: string;
  adminDisplayName: string;
  kpis: HomeKpi[];
  feeStatus: FeeStatusSegment[];
  collections: CollectionMonth[];
  upcomingEvents: UpcomingEvent[];
  attentionItems: AttentionItem[];
};

const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
] as const;

function isCardPayment(fee: MemberFeeRecord): boolean {
  const via = (fee.paidVia ?? "").toLowerCase();
  const provider = (fee.paymentProvider ?? "").toLowerCase();
  return (
    via === "helloasso" ||
    via === "in_app" ||
    provider.includes("helloasso") ||
    provider === "carte_bancaire"
  );
}

function countPendingAids(fees: MemberFeeRecord[]): number {
  let count = 0;
  for (const fee of fees) {
    for (const aid of fee.aids) {
      if (String(aid.status ?? "") === "pending_proof") {
        count += 1;
      }
    }
  }
  return count;
}

function isDeadlineElapsed(deadline: Date | null, clock = new Date()): boolean {
  if (!deadline) return false;
  const end = new Date(
    deadline.getFullYear(),
    deadline.getMonth(),
    deadline.getDate(),
  );
  const today = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate());
  return today.getTime() > end.getTime();
}

function buildCollections(fees: MemberFeeRecord[]): CollectionMonth[] {
  const now = new Date();
  const buckets: CollectionMonth[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const cursor = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    buckets.push({
      month: MONTH_LABELS[cursor.getMonth()],
      cardAmount: 0,
      offlineAmount: 0,
    });
  }

  for (const fee of fees) {
    if (!fee.paidAt || fee.amountPaidCents <= 0) continue;
    const paidMonth = new Date(fee.paidAt.getFullYear(), fee.paidAt.getMonth(), 1);
    const index = buckets.findIndex((bucket, bucketIndex) => {
      const cursor = new Date(now.getFullYear(), now.getMonth() - (5 - bucketIndex), 1);
      return (
        cursor.getFullYear() === paidMonth.getFullYear() &&
        cursor.getMonth() === paidMonth.getMonth()
      );
    });
    if (index < 0) continue;
    const euros = fee.amountPaidCents / 100;
    if (isCardPayment(fee)) {
      buckets[index].cardAmount += euros;
    } else {
      buckets[index].offlineAmount += euros;
    }
  }

  return buckets.map((bucket) => ({
    ...bucket,
    cardAmount: Math.round(bucket.cardAmount),
    offlineAmount: Math.round(bucket.offlineAmount),
  }));
}

const CHART_COLORS = {
  paid: "#22c55e",
  partial: "#facc15",
  unpaid: "#dc4426",
  exempt: "#94a3b8",
} as const;

function buildFeeSegments(fees: MemberFeeRecord[]): FeeStatusSegment[] {
  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;
  let exemptCount = 0;

  for (const fee of fees) {
    if (fee.status === MemberFeeStatuses.paye) paidCount += 1;
    else if (fee.status === MemberFeeStatuses.partiel) partialCount += 1;
    else if (fee.status === MemberFeeStatuses.aPayer) unpaidCount += 1;
    else if (fee.status === MemberFeeStatuses.exonere) exemptCount += 1;
  }

  return [
    { status: "paye", label: "Payé", count: paidCount, color: CHART_COLORS.paid },
    {
      status: "partiel",
      label: "Partiel",
      count: partialCount,
      color: CHART_COLORS.partial,
    },
    {
      status: "a_payer",
      label: "À payer",
      count: unpaidCount,
      color: CHART_COLORS.unpaid,
    },
    {
      status: "exonere",
      label: "Exonéré",
      count: exemptCount,
      color: CHART_COLORS.exempt,
    },
  ];
}

function buildAttention(params: {
  fees: MemberFeeRecord[];
  season: FeeSeasonRecord | null;
  events: UpcomingEvent[];
  pendingAids: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  const overdue = params.fees.filter(
    (fee) =>
      fee.status === MemberFeeStatuses.aPayer &&
      isDeadlineElapsed(params.season?.paymentDeadlineAt ?? null),
  ).length;

  if (overdue > 0) {
    items.push({
      id: "overdue",
      severity: "high",
      title: `${overdue} cotisation${overdue > 1 ? "s" : ""} en retard`,
      detail: "Échéance de saison dépassée",
    });
  }

  if (params.pendingAids > 0) {
    items.push({
      id: "aids",
      severity: "high",
      title: `${params.pendingAids} aide${params.pendingAids > 1 ? "s" : ""} à valider`,
      detail: "Justificatifs en attente de revue",
    });
  }

  const MIN_RSVP_TOTAL_FOR_ALERT = 8;
  const LOW_RSVP_RATIO_THRESHOLD = 0.4;

  for (const event of params.events) {
    if (
      event.rsvpTotal >= MIN_RSVP_TOTAL_FOR_ALERT &&
      event.rsvpYes / event.rsvpTotal < LOW_RSVP_RATIO_THRESHOLD
    ) {
      items.push({
        id: `rsvp-${event.id}`,
        severity: "medium",
        title: `RSVP faible — ${event.title}`,
        detail: `${event.rsvpYes} réponses sur ${event.rsvpTotal}`,
      });
      break;
    }
  }

  if (!params.season) {
    items.push({
      id: "no-season",
      severity: "medium",
      title: "Aucune saison active",
      detail: "Configure les cotisations dans l’onglet Cotisations",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "ok",
      severity: "low",
      title: "Rien d’urgent",
      detail: "Le club est à jour pour le moment",
    });
  }

  return items.slice(0, 4);
}

/**
 * Agrège les données home admin depuis Firestore (KPIs, charts, events).
 */
export async function loadHomeDashboard(params: {
  club: ClubRecord;
  adminDisplayName: string;
}): Promise<HomeDashboardData> {
  const season = await getActiveSeason(params.club.id);
  const fees = season ? await listMemberFees(params.club.id, season.id) : [];
  const upcomingEvents = await loadUpcomingEvents(params.club.id, {
    limit: HOME_PREVIEW_EVENT_LIMIT,
  });
  const pendingAids = countPendingAids(fees);
  const segments = buildFeeSegments(fees);
  const unpaidCount =
    segments.find((segment) => segment.status === "a_payer")?.count ?? 0;
  const paidCount =
    segments.find((segment) => segment.status === "paye")?.count ?? 0;

  return {
    clubName: params.club.name,
    seasonLabel: season ? `Saison ${season.seasonLabel}` : "Aucune saison active",
    adminDisplayName: params.adminDisplayName,
    kpis: [
      {
        id: "members",
        label: "Membres actifs",
        value: params.club.memberCount,
        hint: "Joueurs, coachs, admins",
        tone: "neutral",
      },
      {
        id: "due",
        label: "À payer",
        value: unpaidCount,
        hint: season ? "Cotisations ouvertes" : "Crée une saison",
        tone: "warning",
      },
      {
        id: "paid",
        label: "Payées",
        value: paidCount,
        hint: season ? "Soldées cette saison" : "—",
        tone: "success",
      },
      {
        id: "aids",
        label: "Aides en attente",
        value: pendingAids,
        hint: "Justificatifs à valider",
        tone: "accent",
      },
    ],
    feeStatus: segments,
    collections: buildCollections(fees),
    upcomingEvents,
    attentionItems: buildAttention({
      fees,
      season,
      events: upcomingEvents,
      pendingAids,
    }),
  };
}
