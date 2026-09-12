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

/** Push après stabilisation d’un RSVP (debounce). */
export function eventRsvpChangedCopy(params: {
  memberName: string;
  status: string;
  eventTitle: string;
}): { title: string; body: string } {
  const name = params.memberName.trim() || "Un membre";
  const eventTitle = params.eventTitle.trim() || "Événement";
  const label = rsvpStatusLabel(params.status);
  return {
    title: "Réponse RSVP",
    body: truncatePushBody(`${name} : ${label} — ${eventTitle}`),
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
  key: "events" | "announcements" | "fees" | "rsvp",
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
  }
}
