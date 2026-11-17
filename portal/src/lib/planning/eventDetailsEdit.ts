/**
 * Édition des infos d'un événement (titre, date, heures, lieux) : validation
 * et calcul du patch Firestore. Seuls les champs réellement modifiés sont
 * écrits, pour que le trigger push n'envoie « reporté » / « modifié » qu'à bon
 * escient (miroir de `EventMutations.updateEventDetails` côté app).
 */

import type { EventType } from "@/lib/firebase/eventService";

/** Infos éditables d'un événement (heures `HH:mm`, date calendaire locale). */
export type EditableEventDetails = {
  type: EventType;
  title: string;
  /** Jour de l'événement au format `YYYY-MM-DD`. */
  day: string;
  startTime: string;
  /** Absent pour un match (heure de RDV à la place). */
  endTime: string | null;
  meetingTime: string | null;
  location: string;
  meetingLocation: string | null;
};

/** Champs Firestore d'un patch d'édition (valeur `null` = champ à supprimer). */
export type EventDetailsPatch = {
  title?: string;
  /** Jour `YYYY-MM-DD` : le service écrit `date` (minuit UTC) et `dateId`. */
  day?: string;
  startTime?: string;
  endTime?: string;
  meetingTime?: string;
  location?: string;
  meetingLocation?: string | null;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Le titre est libre (et modifiable) seulement sans équipe : réunion, autre. */
export function hasEditableTitle(type: EventType): boolean {
  return type === "meeting" || type === "other";
}

/** Minutes depuis minuit d'une heure `HH:mm`. */
function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * Première erreur de saisie, ou `null` si le formulaire est valide.
 */
export function validateEventDetails(
  details: EditableEventDetails,
): string | null {
  if (details.type === "other" && !details.title.trim()) {
    return "Le titre est requis.";
  }
  if (!DAY_PATTERN.test(details.day)) return "Choisissez une date.";
  if (!TIME_PATTERN.test(details.startTime)) {
    return "Indiquez l’heure de début.";
  }
  if (details.endTime !== null) {
    if (!TIME_PATTERN.test(details.endTime)) {
      return "Indiquez l’heure de fin.";
    }
    if (minutesOf(details.endTime) <= minutesOf(details.startTime)) {
      return "L’heure de fin doit être après le début.";
    }
  }
  if (details.meetingTime !== null && !TIME_PATTERN.test(details.meetingTime)) {
    return "Indiquez l’heure de rendez-vous.";
  }
  if (!details.location.trim()) return "Le lieu est requis.";
  return null;
}

/**
 * Patch des seuls champs modifiés entre [original] et [next] (vide si rien
 * n'a changé). Les textes sont rognés ; un lieu de RDV vidé est supprimé.
 */
export function buildEventDetailsPatch(
  original: EditableEventDetails,
  next: EditableEventDetails,
): EventDetailsPatch {
  const patch: EventDetailsPatch = {};
  const title = next.title.trim();
  if (hasEditableTitle(next.type) && title !== original.title.trim()) {
    patch.title = title;
  }
  if (next.day !== original.day) patch.day = next.day;
  if (next.startTime !== original.startTime) patch.startTime = next.startTime;
  if (next.endTime !== null && next.endTime !== original.endTime) {
    patch.endTime = next.endTime;
  }
  if (next.meetingTime !== null && next.meetingTime !== original.meetingTime) {
    patch.meetingTime = next.meetingTime;
  }
  const location = next.location.trim();
  if (location !== original.location.trim()) patch.location = location;
  const meetingLocation = next.meetingLocation?.trim() ?? "";
  const originalMeetingLocation = original.meetingLocation?.trim() ?? "";
  if (meetingLocation !== originalMeetingLocation) {
    patch.meetingLocation = meetingLocation || null;
  }
  return patch;
}
