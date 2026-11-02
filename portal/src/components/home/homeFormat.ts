import { eventTypeLabel, type EventType } from "@/lib/firebase/eventService";

/** Heure courte « 18:00 ». */
export function formatEventTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Date longue « lundi 2 novembre · 18:00 ». */
export function formatEventLongWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return `${day} · ${formatEventTime(iso)}`;
}

/** Date courte d’annonce « 2 nov. ». */
export function formatShortDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(date);
}

/** Montant en euros depuis des centimes. */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** Libellé de type d’événement, tolérant aux valeurs inconnues. */
export function safeEventTypeLabel(type: string): string {
  return eventTypeLabel(type as EventType) ?? "";
}

/** Ligne de méta d’un événement : heure · type · équipes · lieu. */
export function eventMetaLine(event: {
  startsAt: string;
  type: string;
  teamLabels: string[];
  location?: string;
}): string {
  return [
    formatEventTime(event.startsAt),
    safeEventTypeLabel(event.type),
    event.teamLabels.join(", "),
    event.location?.trim() ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Premier prénom d’un nom affiché (« Jean-Eudes DE BOYER » → « Jean-Eudes »). */
export function firstNameOf(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}
