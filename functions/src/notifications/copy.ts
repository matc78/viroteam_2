import { ANNOUNCEMENT_BODY_MAX_CHARS } from "./types";

/**
 * Copy des push : tutoiement, titre = de quoi / quand, corps = détails puis
 * action attendue. Pas d'humour sur la cotisation ni les annulations.
 */

/** Tronque un texte pour le corps d'une push (ajoute « … » si besoin). */
export function truncatePushBody(
  text: string,
  maxChars = ANNOUNCEMENT_BODY_MAX_CHARS,
): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export type PushCopy = { title: string; body: string };

/**
 * Contexte d'une push d'événement. Les heures sont déjà au format FR
 * (« 18h00 ») ; [dayLabel] au format « jeu. 23/10 ».
 */
export type EventPushContext = {
  /** Titre de l'event : nom d'équipe (entraînement, match) ou titre libre. */
  title: string;
  type: string;
  dayLabel: string;
  startTime?: string;
  meetingTime?: string;
  location?: string;
  /** Prénom de l'enfant quand la push s'adresse à un parent. */
  childFirstName?: string;
};

/** Statut RSVP de la personne visée (soi ou l'enfant). */
export type RsvpStatus = "yes" | "maybe" | "no" | "none";

/** Libellé FR d’un statut RSVP Firestore. */
export function rsvpStatusLabel(status: string): string {
  switch (String(status ?? "").trim()) {
    case "yes":
      return "Oui";
    case "maybe":
      return "Peut-être";
    case "no":
      return "Non";
    default:
      return "Sans réponse";
  }
}

/** Normalise un statut RSVP Firestore (inconnu = sans réponse). */
export function normalizeRsvpStatus(status: unknown): RsvpStatus {
  const value = String(status ?? "").trim();
  if (value === "yes" || value === "maybe" || value === "no") return value;
  return "none";
}

/** Libellé FR du type d’événement (« Entraînement », « Match »…). */
export function eventTypePushLabel(type: string): string {
  switch (normalizeEventType(type)) {
    case "training":
      return "Entraînement";
    case "match":
      return "Match";
    case "tournament":
      return "Tournoi";
    case "meeting":
      return "Réunion";
    default:
      return "Événement";
  }
}

/** Type d'event canonique (`training`, `match`, `tournament`, `meeting`, `other`). */
export function normalizeEventType(type: string): string {
  switch (String(type ?? "").trim().toLowerCase()) {
    case "training":
    case "entraînement":
    case "entrainement":
      return "training";
    case "match":
      return "match";
    case "tournament":
    case "tournoi":
      return "tournament";
    case "meeting":
    case "réunion":
    case "reunion":
      return "meeting";
    default:
      return "other";
  }
}

/** Type d'event précédé de son article (« l'entraînement », « la réunion »…). */
function eventTypeWithArticle(type: string): string {
  switch (normalizeEventType(type)) {
    case "training":
      return "l’entraînement";
    case "match":
      return "le match";
    case "tournament":
      return "le tournoi";
    case "meeting":
      return "la réunion";
    default:
      return "l’événement";
  }
}

/** Pluriel du type pour le récap (« 2 entraînements »). */
function eventTypeCountLabel(type: string, count: number): string {
  const plural = count > 1;
  switch (normalizeEventType(type)) {
    case "training":
      return `${count} entraînement${plural ? "s" : ""}`;
    case "match":
      return `${count} match${plural ? "s" : ""}`;
    case "tournament":
      return `${count} tournoi${plural ? "s" : ""}`;
    case "meeting":
      return `${count} réunion${plural ? "s" : ""}`;
    default:
      return `${count} événement${plural ? "s" : ""}`;
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinParts(parts: Array<string | undefined>): string {
  return parts.map((part) => part?.trim() ?? "").filter(Boolean).join(" · ");
}

/** « Entraînement jeu. 23/10 à 18h00 ». */
function typeDayTime(ctx: EventPushContext): string {
  const time = ctx.startTime ? ` à ${ctx.startTime}` : "";
  return `${eventTypePushLabel(ctx.type)} ${ctx.dayLabel}${time}`;
}

/**
 * En-tête commun : équipe (ou prénom de l'enfant pour un parent), type, jour
 * et heure. Le titre est omis s'il répète le type.
 */
function eventHeadline(ctx: EventPushContext): string {
  const who = ctx.childFirstName?.trim() || eventSubject(ctx);
  return who ? `${who} · ${typeDayTime(ctx)}` : typeDayTime(ctx);
}

/** Titre de l'event s'il apporte une info (pas une simple répétition du type). */
function eventSubject(ctx: EventPushContext): string {
  const title = ctx.title.trim();
  if (!title) return "";
  if (title.toLowerCase() === eventTypePushLabel(ctx.type).toLowerCase()) return "";
  return title;
}

/** « Tu viens ? » ou « Léo vient ? » selon le destinataire. */
function comingQuestion(ctx: EventPushContext): string {
  const child = ctx.childFirstName?.trim();
  return child ? `${child} vient ?` : "Tu viens ?";
}

/** Rappel J-7 (events importants), pour ceux qui n'ont pas répondu. */
export function eventReminderJ7Copy(ctx: EventPushContext): PushCopy {
  const where = ctx.location ? ` · ${ctx.location}` : "";
  return {
    title: eventHeadline(ctx),
    body: `Dans une semaine${where}. ${comingQuestion(ctx)} Réponds pour que le coach s’organise.`,
  };
}

/** Rappel J-7 pour un « peut-être » encore en suspens. */
export function eventReminderJ7MaybeCopy(ctx: EventPushContext): PushCopy {
  const where = ctx.location ? ` · ${ctx.location}` : "";
  const child = ctx.childFirstName?.trim();
  const ask = child
    ? `${child} est encore en peut-être. Tu confirmes ?`
    : "Tu es encore en peut-être. Tu confirmes ?";
  return {
    title: eventHeadline(ctx),
    body: `Dans une semaine${where}. ${ask}`,
  };
}

/** Rappel J-2, pour ceux qui n'ont pas répondu. */
export function eventReminderJ2Copy(ctx: EventPushContext): PushCopy {
  const child = ctx.childFirstName?.trim();
  return {
    title: eventHeadline(ctx),
    body: child
      ? `Toujours pas de réponse pour ${child}. Un tap suffit.`
      : "Toujours pas de réponse : tu viens ? Un tap suffit.",
  };
}

/** Rappel J-2 pour un « peut-être » encore en suspens. */
export function eventReminderJ2MaybeCopy(ctx: EventPushContext): PushCopy {
  const child = ctx.childFirstName?.trim();
  return {
    title: eventHeadline(ctx),
    body: child
      ? `${child} est encore en peut-être — tu confirmes ?`
      : "Tu es encore en peut-être — tu confirmes ?",
  };
}

/** Bilan J-2 pour les coachs : décompte des réponses avant l'event. */
export function eventCoachJ2SummaryCopy(
  ctx: EventPushContext & { tally: RsvpTally },
): PushCopy {
  return {
    title: typeDayTime(ctx),
    body: truncatePushBody(`Dans 2 jours · ${formatRsvpTally(ctx.tally)}`),
  };
}

/**
 * Rappel du jour J (le matin, ou la veille au soir pour un event matinal),
 * pour ceux qui viennent, hésitent ou n'ont pas répondu.
 */
export function eventDayOfReminderCopy(
  ctx: EventPushContext & { when: "today" | "tomorrow"; rsvp: RsvpStatus },
): PushCopy {
  const child = ctx.childFirstName?.trim();
  const whenLabel = ctx.when === "today" ? "C’est aujourd’hui" : "Demain";
  const time = ctx.startTime ? ` à ${ctx.startTime}` : "";
  const what = `${eventTypePushLabel(ctx.type)}${time}`;
  const title = child
    ? `${whenLabel} pour ${child} : ${what}`
    : `${whenLabel} : ${what}`;
  const details = joinParts([
    eventSubject(ctx),
    ctx.meetingTime ? `RDV ${ctx.meetingTime}` : undefined,
    ctx.location,
  ]);
  const action =
    ctx.rsvp === "none"
      ? child
        ? `Pense à répondre pour ${child}.`
        : "Pense à répondre."
      : "";
  const body = [details, action].filter(Boolean).join(". ");
  return {
    title,
    body: body || "Les détails sont dans le planning.",
  };
}

/** Nouvelle convocation (event créé à 7 jours ou moins). */
export function eventCreatedCopy(ctx: EventPushContext): PushCopy {
  const child = ctx.childFirstName?.trim();
  const titlePrefix = child
    ? `Nouvelle convocation pour ${child}`
    : "Nouvelle convocation";
  const details = joinParts([eventSubject(ctx), ctx.startTime, ctx.location]);
  return {
    title: `${titlePrefix} · ${eventTypePushLabel(ctx.type)} ${ctx.dayLabel}`,
    body: details ? `${details}. ${comingQuestion(ctx)}` : comingQuestion(ctx),
  };
}

/** Push annulation. */
export function eventCanceledCopy(ctx: EventPushContext): PushCopy {
  const child = ctx.childFirstName?.trim();
  const time = ctx.startTime ? ` de ${ctx.startTime}` : "";
  const sentence = `${capitalize(eventTypeWithArticle(ctx.type))}${time} n’aura pas lieu.`;
  const subject = eventSubject(ctx);
  return {
    title: `${child ? `${child} · ` : ""}Annulé · ${eventTypePushLabel(ctx.type)} ${ctx.dayLabel}`,
    body: subject ? `${subject} — ${sentence}` : sentence,
  };
}

/** Push report : [ctx] porte déjà la nouvelle date / heure. */
export function eventPostponedCopy(ctx: EventPushContext): PushCopy {
  const child = ctx.childFirstName?.trim();
  const time = ctx.startTime ? ` à ${ctx.startTime}` : "";
  const subject = eventSubject(ctx);
  const moved = `Maintenant ${ctx.dayLabel}${time}.`;
  const check = child ? `Vérifie la dispo de ${child}.` : "Vérifie ta dispo.";
  return {
    title: `${child ? `${child} · ` : ""}Changement de date · ${eventTypePushLabel(ctx.type)}`,
    body: `${subject ? `${subject} — ` : ""}${moved} ${check}`,
  };
}

/** Champ modifié d'un event, avec sa nouvelle valeur déjà formatée. */
export type EventFieldChange =
  | { field: "location"; value: string }
  | { field: "meetingLocation"; value: string }
  | { field: "meetingTime"; value: string }
  | { field: "endTime"; value: string }
  | { field: "title"; value: string }
  | { field: "type"; value: string }
  | { field: "matchVenue" };

function describeFieldChange(change: EventFieldChange): string {
  switch (change.field) {
    case "location":
      return change.value ? `Nouveau lieu : ${change.value}` : "Lieu mis à jour";
    case "meetingLocation":
      return change.value
        ? `Nouveau lieu de RDV : ${change.value}`
        : "Lieu de RDV mis à jour";
    case "meetingTime":
      return change.value ? `RDV à ${change.value}` : "Heure de RDV mise à jour";
    case "endTime":
      return change.value ? `Fin à ${change.value}` : "Heure de fin mise à jour";
    case "title":
      return change.value ? `Nouveau nom : ${change.value}` : "Nom mis à jour";
    case "type":
      return `C’est maintenant : ${eventTypePushLabel(change.value)}`;
    case "matchVenue":
      return "Domicile / extérieur mis à jour";
  }
}

/** Push modification : dit concrètement ce qui a changé. */
export function eventModifiedCopy(
  ctx: EventPushContext & { changes: EventFieldChange[] },
): PushCopy {
  const child = ctx.childFirstName?.trim();
  const described = ctx.changes.map(describeFieldChange);
  return {
    title: `${child ? `${child} · ` : ""}${typeDayTime(ctx)} modifié`,
    body: truncatePushBody(
      described.length > 0 ? `${described.join(" · ")}.` : "Les infos ont changé, jette un œil.",
    ),
  };
}

/** Push manuelle coach / admin. */
export function eventManualPushCopy(
  ctx: EventPushContext & { rsvp: RsvpStatus },
): PushCopy {
  const who = ctx.childFirstName?.trim() || eventSubject(ctx);
  const details = joinParts([typeDayTime(ctx), ctx.location]);
  return {
    title: `${who ? `${who} · ` : ""}Rappel du coach`,
    body: ctx.rsvp === "none" ? `${details} — ${comingQuestion(ctx).toLowerCase()}` : details,
  };
}

/**
 * Nom court pour une push RSVP : « Prénom N. ».
 * Fallback sur displayName (même format) puis « Un membre ».
 */
export function formatMemberShortName(params: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}): string {
  const firstName = String(params.firstName ?? "").trim();
  const lastName = String(params.lastName ?? "").trim();
  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
  }
  if (firstName) return firstName;

  const displayName = String(params.displayName ?? "").trim();
  if (!displayName) return "Un membre";
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    // Prénom = 1er token ; nom = le reste → initiale du début du nom (« DEL… » → D.).
    const lastNameStart = parts[1]!;
    return `${parts[0]} ${lastNameStart.charAt(0).toUpperCase()}.`;
  }
  return displayName;
}

/** Une réponse RSVP dans un digest push. */
export type RsvpDigestEntry = {
  memberName: string;
  status: string;
};

/** Décompte des réponses d'un event (convoqués). */
export type RsvpTally = { yes: number; no: number; maybe: number; none: number };

/** « 12 oui, 3 non, 1 peut-être, 4 sans réponse » (zéros omis sauf oui / non). */
export function formatRsvpTally(tally: RsvpTally): string {
  const parts = [`${tally.yes} oui`, `${tally.no} non`];
  if (tally.maybe > 0) parts.push(`${tally.maybe} peut-être`);
  if (tally.none > 0) parts.push(`${tally.none} sans réponse`);
  return parts.join(", ");
}

/** « Marie D. vient », « Paul G. ne vient pas »… */
function rsvpSentence(name: string, status: string): string {
  switch (normalizeRsvpStatus(status)) {
    case "yes":
      return `${name} vient`;
    case "no":
      return `${name} ne vient pas`;
    case "maybe":
      return `${name} : peut-être`;
    default:
      return `${name} a retiré sa réponse`;
  }
}

/**
 * Push après stabilisation d’un ou plusieurs RSVP (digest anti-spam), pour le
 * staff et les joueurs qui suivent leurs coéquipiers. Le décompte aide le
 * coach à savoir s'il a assez de monde.
 */
export function eventRsvpChangedCopy(params: {
  responses: RsvpDigestEntry[];
  ctx: EventPushContext;
  tally: RsvpTally;
}): PushCopy {
  const responses = params.responses.length > 0
    ? params.responses
    : [{ memberName: "Un membre", status: "none" }];
  const lead =
    responses.length === 1
      ? rsvpSentence(responses[0]!.memberName.trim() || "Un membre", responses[0]!.status)
      : `${responses.length} nouvelles réponses`;
  return {
    title: eventHeadline({ ...params.ctx, childFirstName: undefined }),
    body: truncatePushBody(`${lead} · ${formatRsvpTally(params.tally)}`),
  };
}

/**
 * Confirmation au parent quand la réponse de son enfant a été posée par
 * quelqu'un d'autre (autre parent, coach).
 */
export function childRsvpConfirmationCopy(params: {
  ctx: EventPushContext;
  status: string;
}): PushCopy {
  const child = params.ctx.childFirstName?.trim() || "Ton enfant";
  return {
    title: eventHeadline(params.ctx),
    body: `Réponse enregistrée pour ${child} : ${rsvpStatusLabel(params.status)}.`,
  };
}

/** Un event dans le récap hebdo d'une personne. */
export type WeeklyDigestItem = {
  type: string;
  dayLabel: string;
  /** `true` si une réponse est attendue (soi ou un enfant). */
  awaitingResponse: boolean;
};

/**
 * Récap du dimanche soir : ce qui attend la personne la semaine suivante et
 * les réponses manquantes. `null` si rien au programme (pas d'envoi).
 */
export function weeklyDigestCopy(items: WeeklyDigestItem[]): PushCopy | null {
  if (items.length === 0) return null;
  const counts = new Map<string, number>();
  for (const item of items) {
    const type = normalizeEventType(item.type);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  const order = ["match", "tournament", "training", "meeting", "other"];
  const summary = order
    .filter((type) => counts.has(type))
    .map((type) => eventTypeCountLabel(type, counts.get(type)!))
    .join(", ");

  const pendingDays = [
    ...new Set(items.filter((item) => item.awaitingResponse).map((item) => item.dayLabel)),
  ];
  const pendingCount = items.filter((item) => item.awaitingResponse).length;
  const body =
    pendingCount === 0
      ? "Tout est répondu, bonne semaine !"
      : `${pendingCount} réponse${pendingCount > 1 ? "s" : ""} attendue${pendingCount > 1 ? "s" : ""} (${pendingDays.join(", ")}). Jette un œil au planning.`;
  return {
    title: `Ta semaine : ${summary}`,
    body: truncatePushBody(body),
  };
}

/** Push publication d'annonce. */
export function announcementPublishedCopy(params: {
  clubName: string;
  message: string;
}): PushCopy {
  const club = params.clubName.trim();
  return {
    title: club ? `${club} · Nouvelle annonce` : "Nouvelle annonce",
    body: truncatePushBody(params.message),
  };
}

/** Push cotisation hebdomadaire (ton neutre, pas d'humour). */
export function feeReminderCopy(params: {
  clubName: string;
  seasonLabel: string;
  deadlineLabel?: string | null;
  overdue: boolean;
}): PushCopy {
  const season = params.seasonLabel.trim();
  const club = params.clubName.trim();
  const subject = `Cotisation${season ? ` ${season}` : ""}`;
  const title = club ? `${club} · ${subject}` : subject;
  if (params.overdue) {
    return {
      title,
      body: params.deadlineLabel
        ? `Date limite dépassée (${params.deadlineLabel}). Règle-la dès que possible.`
        : "Date limite dépassée. Règle-la dès que possible.",
    };
  }
  return {
    title,
    body: params.deadlineLabel
      ? `À régler avant le ${params.deadlineLabel}.`
      : "Pense à régler ta cotisation.",
  };
}

/** Texte de confirmation quand on désactive une préférence. */
export function preferenceOffWarning(
  key: "events" | "announcements" | "fees" | "rsvp" | "chat" | "weeklyDigest",
): string {
  switch (key) {
    case "events":
      return "Tu ne recevras plus les rappels (J-2, jour J) ni les notifs envoyées par les coachs.";
    case "announcements":
      return "Tu ne recevras plus de notif quand le club publie une annonce.";
    case "fees":
      return "Tu ne recevras plus les rappels de cotisation.";
    case "rsvp":
      return "Tu ne recevras plus de notif quand quelqu’un répond à une convocation.";
    case "chat":
      return "Tu ne recevras plus de notif pour les nouveaux messages.";
    case "weeklyDigest":
      return "Tu ne recevras plus le récap de la semaine le dimanche soir.";
  }
}
