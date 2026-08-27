/** Configuration publique du site ViroTeam. */
export const site = {
  name: "ViroTeam",
  url: "https://www.viroteam.com",
  tagline: "Organisez. Suivez. Pilotez.",
  logoMark: "/logo-mark.png",
  logoStacked: "/logo.png",
  logoWordmark: "/logo-wordmark.png",
  ogImage: "/og-image.png",
  description:
    "Planning, convocations et suivi des cotisations pour le bureau. Membres et parents suivent simplement — multiclub inclus.",
  seoTitle: "ViroTeam — L'app de gestion pour les clubs amateurs",
  seoDescription:
    "ViroTeam est l'application de gestion pour les clubs amateurs. Elle centralise planning, convocations, cotisations et équipes — pour le bureau, les coachs, les joueurs et les parents.",
  playStoreUrl:
    "https://play.google.com/store/apps/details?id=com.viroteam.viro_team",
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
