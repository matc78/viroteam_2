import { ClubRecord } from "./clubService";
import {
  HOME_PREVIEW_EVENT_LIMIT,
  loadTeamsForClub,
  loadUpcomingEvents,
  type UpcomingEvent,
} from "./eventService";
import { MemberFeeStatuses } from "./constants";
import {
  FeeSeasonRecord,
  getActiveSeason,
  getMemberFee,
  isDeadlineElapsed,
  listMemberFees,
  MemberFeeRecord,
  remainingCents,
} from "./feeService";
import {
  getLinkedMemberId,
  listClubMembers,
  type ClubMemberRecord,
} from "./memberService";
import {
  loadAnnouncementsForMember,
} from "./announcementService";
import {
  eventTouchesTeams,
  eventVisibleToPlayer,
  teamsCoachedByViewer,
  viewerMatchIds,
} from "@/lib/teams/viewerTeamScope";
import { resolveMemberTeams } from "@/lib/members/membersView";


type FeeStatus = "paye" | "partiel" | "a_payer" | "exonere";

export type HomeKpi = {
  id: string;
  label: string;
  value: number;
  hint: string;
  tone: "neutral" | "warning" | "success" | "accent";
  /** Suffixe affiché après la valeur (ex. %, €). */
  suffix?: string;
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

const MIN_RSVP_TOTAL_FOR_ALERT = 8;
const LOW_RSVP_RATIO_THRESHOLD = 0.4;
const MAX_ATTENTION_ITEMS = 4;

/** Construit les alertes bureau : RSVP d’abord, puis cotisations / aides. */
function buildAttention(params: {
  fees: MemberFeeRecord[];
  season: FeeSeasonRecord | null;
  events: UpcomingEvent[];
  pendingAids: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const event of params.events) {
    if (
      event.rsvpTotal >= MIN_RSVP_TOTAL_FOR_ALERT &&
      event.rsvpYes / event.rsvpTotal < LOW_RSVP_RATIO_THRESHOLD
    ) {
      items.push({
        id: `rsvp-${event.id}`,
        severity: "medium",
        title: `RSVP faible — ${event.title}`,
        detail: `${event.rsvpYes} présents · ${event.rsvpPending} en attente sur ${event.rsvpTotal}`,
      });
    }
    if (items.length >= MAX_ATTENTION_ITEMS) {
      return items;
    }
  }

  const overdue = params.fees.filter(
    (fee) =>
      fee.status === MemberFeeStatuses.aPayer &&
      isDeadlineElapsed(params.season?.paymentDeadlineAt ?? null),
  ).length;

  if (overdue > 0 && items.length < MAX_ATTENTION_ITEMS) {
    items.push({
      id: "overdue",
      severity: "high",
      title: `${overdue} cotisation${overdue > 1 ? "s" : ""} en retard`,
      detail: "Échéance de saison dépassée",
    });
  }

  if (params.pendingAids > 0 && items.length < MAX_ATTENTION_ITEMS) {
    items.push({
      id: "aids",
      severity: "high",
      title: `${params.pendingAids} aide${params.pendingAids > 1 ? "s" : ""} à valider`,
      detail: "Justificatifs en attente de revue",
    });
  }

  if (!params.season && items.length < MAX_ATTENTION_ITEMS) {
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

  return items.slice(0, MAX_ATTENTION_ITEMS);
}

/** Équipe entraînée (home coach). */
export type CoachHomeTeam = {
  id: string;
  name: string;
  category: string;
  playerCount: number;
};

/** Ligne RSVP / attendance pour la semaine à venir (home coach). */
export type CoachWeekEventSummary = {
  id: string;
  title: string;
  startsAt: string;
  type: string;
  teamLabels: string[];
  rsvpYes: number;
  rsvpNo: number;
  rsvpPending: number;
  rsvpTotal: number;
};

/** Données home coach (scope équipes). */
export type CoachHomeDashboardData = {
  clubName: string;
  displayName: string;
  memberCount: number;
  teams: CoachHomeTeam[];
  trainingCount: number;
  upcomingEvents: UpcomingEvent[];
  weekEvents: CoachWeekEventSummary[];
};

/** Données home joueur. */
export type PlayerHomeDashboardData = {
  clubName: string;
  displayName: string;
  linkedMemberId: string | null;
  upcomingEvents: UpcomingEvent[];
  announcements: Array<{
    id: string;
    message: string;
    senderName: string;
    createdAt: Date | null;
  }>;
  fee: MemberFeeRecord | null;
  season: FeeSeasonRecord | null;
  remainingCents: number;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Fenêtre « semaine qui arrive » : du lundi prochain au dimanche suivant (7 j). */
function nextWeekWindow(clock = new Date()): { start: Date; end: Date } {
  const today = startOfDay(clock);
  const day = today.getDay(); // 0=dim … 6=sam
  const daysUntilNextMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const start = addDays(today, daysUntilNextMonday);
  const end = addDays(start, 7);
  return { start, end };
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
  const allUpcomingEvents = await loadUpcomingEvents(params.club.id);
  const upcomingEvents = allUpcomingEvents.slice(0, HOME_PREVIEW_EVENT_LIMIT);
  const upcomingEventCount = allUpcomingEvents.length;
  const pendingAids = countPendingAids(fees);
  const segments = buildFeeSegments(fees);

  const billableFees = fees.filter(
    (fee) => fee.status !== MemberFeeStatuses.exonere,
  );
  const paidCount = billableFees.filter(
    (fee) => fee.status === MemberFeeStatuses.paye,
  ).length;
  const paidPercent =
    billableFees.length > 0
      ? Math.round((paidCount / billableFees.length) * 100)
      : 0;

  const remainingDueEuros = season
    ? Math.round(
        fees.reduce((sum, fee) => sum + remainingCents(fee, season), 0) / 100,
      )
    : 0;

  const eventsWithInvitees = allUpcomingEvents.filter(
    (event) => event.rsvpTotal > 0,
  );
  const averageRsvpPercent =
    eventsWithInvitees.length > 0
      ? Math.round(
          (eventsWithInvitees.reduce(
            (sum, event) => sum + event.rsvpYes / event.rsvpTotal,
            0,
          ) /
            eventsWithInvitees.length) *
            100,
        )
      : 0;

  return {
    clubName: params.club.name,
    seasonLabel: season ? `Saison ${season.seasonLabel}` : "Aucune saison active",
    adminDisplayName: params.adminDisplayName,
    kpis: [
      {
        id: "events",
        label: "Événements à venir",
        value: upcomingEventCount,
        hint: "Prochains 14 jours",
        tone: "neutral",
      },
      {
        id: "rsvp-rate",
        label: "Taux RSVP moyen",
        value: averageRsvpPercent,
        suffix: "%",
        hint: "Oui / convoqués · 14 j",
        tone: "accent",
      },
      {
        id: "paid-rate",
        label: "Cotisations soldées",
        value: paidPercent,
        suffix: "%",
        hint: season ? "Hors exonérés" : "Crée une saison",
        tone: "success",
      },
      {
        id: "due-euros",
        label: "Reste dû",
        value: remainingDueEuros,
        suffix: "€",
        hint: season ? "À encaisser" : "Crée une saison",
        tone: "warning",
      },
    ],
    feeStatus: segments,
    collections: buildCollections(fees),
    upcomingEvents,
    attentionItems: buildAttention({
      fees,
      season,
      events: allUpcomingEvents,
      pendingAids,
    }),
  };
}

/**
 * Home coach : KPIs scope équipes entraînées, events et RSVP semaine prochaine.
 */
export async function loadCoachHomeDashboard(params: {
  club: ClubRecord;
  displayName: string;
  uid: string;
}): Promise<CoachHomeDashboardData> {
  const [teams, members, allUpcomingEvents, linkedMemberId] = await Promise.all([
    loadTeamsForClub(params.club.id),
    listClubMembers(params.club.id),
    loadUpcomingEvents(params.club.id),
    getLinkedMemberId(params.club.id, params.uid),
  ]);

  const matchIds = viewerMatchIds({
    uid: params.uid,
    memberId: linkedMemberId,
  });
  const coachedTeams = teamsCoachedByViewer(teams, matchIds);
  const viewerTeamIdSet = new Set(coachedTeams.map((team) => team.id));

  const memberIdSet = new Set<string>();
  for (const team of coachedTeams) {
    for (const playerId of team.playerIds) {
      if (playerId) memberIdSet.add(playerId);
    }
    for (const coachId of team.coachIds) {
      if (coachId) memberIdSet.add(coachId);
    }
  }
  for (const member of members) {
    const resolved = resolveMemberTeams(member, teams);
    if (resolved.teamIds.some((teamId) => viewerTeamIdSet.has(teamId))) {
      memberIdSet.add(member.memberId);
      if (member.accountUid) memberIdSet.add(member.accountUid);
    }
  }

  const scopedMembers = members.filter((member) => {
    const ids = [member.memberId, member.accountUid].filter(Boolean) as string[];
    return ids.some((id) => memberIdSet.has(id));
  });

  const scopedEvents = allUpcomingEvents.filter((event) =>
    eventTouchesTeams(event, viewerTeamIdSet),
  );

  const { start, end } = nextWeekWindow();
  const startMs = start.getTime();
  const endMs = end.getTime();
  const weekEvents: CoachWeekEventSummary[] = scopedEvents
    .filter((event) => {
      const ms = new Date(event.startsAt).getTime();
      return ms >= startMs && ms < endMs;
    })
    .map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      type: event.type,
      teamLabels: event.teamLabels,
      rsvpYes: event.rsvpYes,
      rsvpNo: event.rsvpNo,
      rsvpPending: event.rsvpPending,
      rsvpTotal: event.rsvpTotal,
    }));

  const trainingCount = scopedEvents.filter(
    (event) => event.type === "training",
  ).length;

  return {
    clubName: params.club.name,
    displayName: params.displayName,
    memberCount: scopedMembers.length,
    teams: coachedTeams.map((team) => ({
      id: team.id,
      name: team.name,
      category: team.category,
      playerCount: team.playerIds.length,
    })),
    trainingCount,
    upcomingEvents: scopedEvents.slice(0, HOME_PREVIEW_EVENT_LIMIT),
    weekEvents,
  };
}

/**
 * Home joueur : prochains events + RSVP, annonces actives visibles.
 */
export async function loadPlayerHomeDashboard(params: {
  club: ClubRecord;
  displayName: string;
  uid: string;
}): Promise<PlayerHomeDashboardData> {
  const linkedMemberId = await getLinkedMemberId(params.club.id, params.uid);
  const [teams, allUpcomingEvents, members, season] = await Promise.all([
    loadTeamsForClub(params.club.id),
    loadUpcomingEvents(params.club.id),
    listClubMembers(params.club.id),
    getActiveSeason(params.club.id),
  ]);

  const matchIds = viewerMatchIds({
    uid: params.uid,
    memberId: linkedMemberId,
  });
  const playerTeams = teams.filter((team) =>
    team.playerIds.some((id) => matchIds.has(id)),
  );
  const viewerTeamIdSet = new Set(playerTeams.map((team) => team.id));

  const scopedEvents = allUpcomingEvents
    .filter((event) =>
      eventVisibleToPlayer({
        event,
        viewerTeamIds: viewerTeamIdSet,
        playerMatchIds: matchIds,
      }),
    )
    .slice(0, HOME_PREVIEW_EVENT_LIMIT);

  let announcements: PlayerHomeDashboardData["announcements"] = [];
  const member =
    (linkedMemberId
      ? members.find((row) => row.memberId === linkedMemberId)
      : null) ??
    members.find(
      (row) =>
        row.accountUid === params.uid || row.memberId === params.uid,
    ) ??
    null;

  if (member) {
    const memberWithTeams: ClubMemberRecord = {
      ...member,
      teamIds:
        member.teamIds.length > 0
          ? member.teamIds
          : resolveMemberTeams(member, teams).teamIds,
    };
    const teamCategoryById = new Map(
      teams.map((team) => [team.id, team.category]),
    );
    const loaded = await loadAnnouncementsForMember({
      clubId: params.club.id,
      member: memberWithTeams,
      teamCategoryById,
    });
    announcements = loaded.map((announcement) => ({
      id: announcement.id,
      message: announcement.message,
      senderName: [announcement.senderFirstName, announcement.senderLastName]
        .filter(Boolean)
        .join(" ")
        .trim() || "Club",
      createdAt: announcement.createdAt,
    }));
  }

  let fee: MemberFeeRecord | null = null;
  let remainingFeeCents = 0;
  const feeMemberId =
    linkedMemberId ??
    member?.memberId ??
    null;
  if (season && feeMemberId) {
    try {
      fee = await getMemberFee(params.club.id, season.id, feeMemberId);
      if (fee) remainingFeeCents = remainingCents(fee, season);
    } catch {
      // Cotisation illisible : on laisse l’accueil sans encart frais.
    }
  }

  return {
    clubName: params.club.name,
    displayName: params.displayName,
    linkedMemberId,
    upcomingEvents: scopedEvents,
    announcements,
    fee,
    season,
    remainingCents: remainingFeeCents,
  };
}
