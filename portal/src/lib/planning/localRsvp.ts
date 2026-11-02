import type { ClubEventView } from "@/lib/firebase/eventService";

/** Réponse RSVP possible côté UI. */
export type RsvpValue = "yes" | "maybe" | "no";

/**
 * Applique une réponse RSVP locale (optimistic UI) sur un événement :
 * écrit `value` pour chaque id (memberId + alias) et recalcule les compteurs.
 */
export function withLocalRsvp<T extends ClubEventView>(
  event: T,
  memberIds: string[],
  value: RsvpValue,
): T {
  const nextMap = { ...event.rsvpByMemberId };
  for (const id of memberIds) {
    if (id) nextMap[id] = value;
  }
  const values = Object.values(nextMap).map((entry) => entry.toLowerCase());
  const rsvpYes = values.filter((entry) => entry === "yes").length;
  const rsvpNo = values.filter((entry) => entry === "no").length;
  const rsvpTotal =
    event.rsvpTotal > 0 ? event.rsvpTotal : event.teamMemberIds.length;
  const rsvpPending = Math.max(0, rsvpTotal - rsvpYes - rsvpNo);
  return {
    ...event,
    rsvpByMemberId: nextMap,
    rsvpYes,
    rsvpNo,
    rsvpPending,
    rsvpTotal,
  };
}

/**
 * True si les données portent déjà `value` : au moins un id répond, et tous
 * les ids qui ont une réponse portent `value`.
 */
export function eventHasRsvp(
  event: ClubEventView,
  memberIds: string[],
  value: RsvpValue,
): boolean {
  const answers = memberIds
    .map((id) => (event.rsvpByMemberId[id] ?? "").toLowerCase())
    .filter(Boolean);
  return answers.length > 0 && answers.every((answer) => answer === value);
}
