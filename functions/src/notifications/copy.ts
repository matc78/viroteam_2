import { ANNOUNCEMENT_BODY_MAX_CHARS } from "./types";

/** Tronque un texte pour le corps d'une push (ajoute « … » si besoin). */
export function truncatePushBody(
  text: string,
  maxChars = ANNOUNCEMENT_BODY_MAX_CHARS,
): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

/** Corps / titre pour un rappel J-7 (date en jj/mm). */
export function eventReminderJ7Copy(
  title: string,
  dateLabel: string,
): { title: string; body: string } {
  const eventTitle = title.trim() || "Événement";
  const dayMonth = dateLabel.trim() || "date à confirmer";
  return {
    title: `Rappel — ${dayMonth}`,
    body: eventTitle,
  };
}

/** Corps / titre pour un rappel J-2 (date en jj/mm). */
export function eventReminderJ2Copy(
  title: string,
  dateLabel: string,
): { title: string; body: string } {
  const eventTitle = title.trim() || "Événement";
  const dayMonth = dateLabel.trim() || "date à confirmer";
  return {
    title: `Rappel — ${dayMonth}`,
    body: eventTitle,
  };
}

/** Push manuelle coach/admin. */
export function eventManualPushCopy(params: {
  title: string;
  dateLabel: string;
  startTime?: string;
}): { title: string; body: string } {
  const eventTitle = params.title.trim() || "Événement";
  const time =
    typeof params.startTime === "string" && params.startTime.trim().length > 0
      ? ` à ${params.startTime.trim()}`
      : "";
  return {
    title: "Rappel événement",
    body: `${eventTitle} — ${params.dateLabel}${time}`,
  };
}

/** Push annulation. */
export function eventCanceledCopy(title: string): { title: string; body: string } {
  const eventTitle = title.trim() || "Événement";
  return {
    title: "Événement annulé",
    body: eventTitle,
  };
}

/** Push report (date / heure). */
export function eventPostponedCopy(params: {
  title: string;
  dateLabel: string;
  startTime?: string;
}): { title: string; body: string } {
  const eventTitle = params.title.trim() || "Événement";
  const time =
    typeof params.startTime === "string" && params.startTime.trim().length > 0
      ? ` à ${params.startTime.trim()}`
      : "";
  return {
    title: "Événement reporté",
    body: `${eventTitle} — nouvelle date : ${params.dateLabel}${time}`,
  };
}

/** Push modification générique. */
export function eventModifiedCopy(title: string): { title: string; body: string } {
  const eventTitle = title.trim() || "Événement";
  return {
    title: "Événement modifié",
    body: eventTitle,
  };
}

/** Libellé FR d’un statut RSVP Firestore. */
export function rsvpStatusLabel(status: string): string {
  switch (String(status ?? "").trim()) {
    case "yes":
      return "Oui";
    case "maybe":
      return "Peut-être";
    case "no":
      return "Non";
    case "none":
      return "Sans réponse";
    default:
      return "Sans réponse";
  }
}

/** Libellé FR du type d’événement pour le titre d’une push RSVP. */
export function eventTypePushLabel(type: string): string {
  switch (String(type ?? "").trim().toLowerCase()) {
    case "training":
    case "entraînement":
    case "entrainement":
      return "Entraînement";
    case "match":
      return "Match";
    case "tournament":
    case "tournoi":
      return "Tournoi";
    case "meeting":
    case "réunion":
    case "reunion":
      return "Réunion";
    default:
      return "Événement";
  }
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

/**
 * Push après stabilisation d’un ou plusieurs RSVP (digest anti-spam).
 * Titre : « Entraînement 25/10 » ; corps 1 ou N réponses + titre d’événement.
 */
export function eventRsvpChangedCopy(params: {
  responses: RsvpDigestEntry[];
  eventTitle: string;
  eventType: string;
  dateLabel: string;
}): { title: string; body: string } {
  const eventTitle = params.eventTitle.trim() || "Événement";
  const dateLabel = params.dateLabel.trim() || "date à confirmer";
  const typeLabel = eventTypePushLabel(params.eventType);
  const title = `${typeLabel} ${dateLabel}`;

  const responses = params.responses.length > 0
    ? params.responses
    : [{ memberName: "Un membre", status: "none" }];

  const parts = responses.map((entry) => {
    const name = entry.memberName.trim() || "Un membre";
    return `${name} : ${rsvpStatusLabel(entry.status)}`;
  });

  const bodyCore =
    responses.length === 1
      ? `${parts[0]} — ${eventTitle}`
      : `${responses.length} réponses — ${parts.join(", ")} — ${eventTitle}`;

  return {
    title,
    body: truncatePushBody(bodyCore),
  };
}

/** Push publication d'annonce. */
export function announcementPublishedCopy(message: string): {
  title: string;
  body: string;
} {
  return {
    title: "Nouvelle annonce",
    body: truncatePushBody(message),
  };
}

/** Push cotisation hebdomadaire. */
export function feeReminderCopy(params: {
  seasonLabel: string;
  deadlineLabel?: string | null;
  overdue: boolean;
}): { title: string; body: string } {
  const season = params.seasonLabel.trim() || "saison en cours";
  if (params.overdue) {
    return {
      title: "Cotisation en retard",
      body: params.deadlineLabel
        ? `${season} — date limite dépassée (${params.deadlineLabel})`
        : `${season} — merci de régulariser au plus vite`,
    };
  }
  return {
    title: "Rappel cotisation",
    body: params.deadlineLabel
      ? `${season} — à régler avant le ${params.deadlineLabel}`
      : `${season} — n’oubliez pas de régler votre cotisation`,
  };
}

/** Texte de confirmation quand on désactive une préférence. */
export function preferenceOffWarning(
  key: "events" | "announcements" | "fees" | "rsvp" | "chat",
): string {
  switch (key) {
    case "events":
      return "Vous ne recevrez plus les rappels d’événements (J-7, J-2) ni les notifications envoyées par les coaches.";
    case "announcements":
      return "Vous ne recevrez plus de notification à la publication des annonces du club.";
    case "fees":
      return "Vous ne recevrez plus les rappels hebdomadaires de cotisation.";
    case "rsvp":
      return "Vous ne recevrez plus de notification à chaque changement de RSVP.";
    case "chat":
      return "Vous ne recevrez plus de notification pour les nouveaux messages.";
  }
}
