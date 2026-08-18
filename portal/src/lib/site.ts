/** Configuration publique du site ViroTeam. */
export const site = {
  name: "ViroTeam",
  tagline: "Tout le club, une seule app",
  logoMark: "/logo-mark.png",
  logoStacked: "/logo.png",
  logoWordmark: "/logo-wordmark.png",
  description:
    "Pilotez planning, RSVP, cotisations et équipes — joueurs, coachs, parents et admins réunis.",
  playStoreUrl:
    "https://play.google.com/store/apps/details?id=com.viroteam.viro_team_v2",
  /** App Store pas encore publié. */
  appStoreUrl: null as string | null,
  /** Schéma deep link app mobile. */
  appScheme: "viroteam",
} as const;

/** Deep link pour rejoindre un club dans l’app (`viroteam://join?code=…`). */
export function appJoinDeepLink(code: string): string {
  const normalized = code.trim().toUpperCase();
  return `${site.appScheme}://join?code=${encodeURIComponent(normalized)}`;
}

/** Page web intermédiaire qui tente d’ouvrir l’app. */
export function webJoinRedirectPath(code: string): string {
  const normalized = code.trim().toUpperCase();
  return `/join?code=${encodeURIComponent(normalized)}`;
}
