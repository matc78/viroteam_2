/**
 * Construit les deep links app (`viroteam://…`) inclus dans le payload data.
 */

/** Planning au jour de l'événement (pas l'event lui-même). */
export function planningDeepLink(clubId: string, dateIdYyyyMmDd: string): string {
  const dateIso = dateIdToIsoDate(dateIdYyyyMmDd);
  return `viroteam://planning?clubId=${encodeURIComponent(clubId)}&date=${encodeURIComponent(dateIso)}`;
}

/** Accueil / home du club. */
export function homeDeepLink(clubId: string): string {
  return `viroteam://home?clubId=${encodeURIComponent(clubId)}`;
}

/** Onglet cotisation. */
export function feesDeepLink(clubId: string): string {
  return `viroteam://fees?clubId=${encodeURIComponent(clubId)}`;
}

/** Convertit `YYYYMMDD` → `YYYY-MM-DD` (fallback = entrée brute). */
export function dateIdToIsoDate(dateId: string): string {
  const trimmed = dateId.trim();
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  return trimmed;
}

/** Convertit un Date (UTC millis) en `YYYYMMDD` Europe/Paris. */
export function parisDateId(date: Date): string {
  const parts = parisDateParts(date);
  return `${parts.year}${pad2(parts.month)}${pad2(parts.day)}`;
}

/** Libellé FR court d'une date Paris (ex. « lun. 8 sept. »). */
export function parisDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/** Ajoute `days` calendaires à une dateId Paris `YYYYMMDD`. */
export function addDaysToDateId(dateId: string, days: number): string {
  const iso = dateIdToIsoDate(dateId);
  const [y, m, d] = iso.split("-").map(Number);
  // Midi UTC pour éviter les bascules DST en bordure.
  const base = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);
  return parisDateId(base);
}

export type ParisDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/** Parties calendaires Europe/Paris d'un instant. */
export function parisDateParts(date: Date): ParisDateParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return Number(value ?? 0);
  };
  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    hour: lookup("hour"),
    minute: lookup("minute"),
  };
}

/**
 * Instant approximatif de début d'event (date Firestore minuit + startTime HH:mm)
 * interprété en Europe/Paris.
 */
export function eventStartsAtParis(params: {
  date: Date;
  startTime?: string | null;
}): Date {
  const dateId = parisDateId(params.date);
  const iso = dateIdToIsoDate(dateId);
  const [y, m, d] = iso.split("-").map(Number);
  const time = (params.startTime ?? "00:00").trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  const hour = match ? Number(match[1]) : 0;
  const minute = match ? Number(match[2]) : 0;
  // Construit un ISO avec offset Paris via format inverse : on utilise
  // une heuristique UTC+1/+2 via le décalage observé à midi ce jour-là.
  const noonUtc = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  const parisAtNoon = parisDateParts(noonUtc);
  const offsetHours = 12 - parisAtNoon.hour;
  return new Date(Date.UTC(y!, m! - 1, d!, hour - offsetHours, minute, 0));
}

/** Nombre de jours calendaires Paris entre « aujourd'hui » et `eventDateId`. */
export function calendarDaysUntil(params: {
  now: Date;
  eventDateId: string;
}): number {
  const todayId = parisDateId(params.now);
  const todayIso = dateIdToIsoDate(todayId);
  const eventIso = dateIdToIsoDate(params.eventDateId);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const [ey, em, ed] = eventIso.split("-").map(Number);
  const todayUtc = Date.UTC(ty!, tm! - 1, td!);
  const eventUtc = Date.UTC(ey!, em! - 1, ed!);
  return Math.round((eventUtc - todayUtc) / (24 * 60 * 60 * 1000));
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}
