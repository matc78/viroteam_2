/** Libellé FR accordé au compteur RSVP (0 et 1 au singulier). */
export function rsvpStatLabel(
  count: number,
  singular: string,
  plural: string,
): string {
  return count > 1 ? plural : singular;
}
