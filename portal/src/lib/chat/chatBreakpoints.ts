/**
 * Points de rupture de la messagerie (px). Les `@media` des modules CSS du
 * chat n’utilisent que ces valeurs (garde-fou `chatBreakpoints.test.ts`) :
 * - `mobileMax` : page Messages en bascule liste ↔ fil, dock plein écran ;
 * - `tabletMax` : panneaux latéraux par-dessus le fil, fenêtre flottante
 *   ancrée en haut à droite.
 */
export const ChatBreakpoints = {
  mobileMax: 767,
  tabletMax: 1024,
} as const;

/** Media query du layout mobile (même seuil que les CSS `max-width: 767px`). */
export const chatMobileMediaQuery = `(max-width: ${ChatBreakpoints.mobileMax}px)`;
