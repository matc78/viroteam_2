/** Configuration publique du site ViroTeam. */
export const site = {
  name: "ViroTeam",
  url: "https://www.viroteam.com",
  tagline: "Organisez. Relancez. Suivez.",
  logoMark: "/logo-mark.png",
  logoStacked: "/logo.png",
  logoWordmark: "/logo-wordmark.png",
  ogImage: "/og-image.png",
  description:
    "Planning, relances et suivi des cotisations pour le bureau. Membres et parents suivent simplement — multiclub inclus.",
  seoTitle: "ViroTeam — Gestion de club pour le bureau et les parents",
  seoDescription:
    "ViroTeam organise le planning, les relances et le suivi des cotisations. Le bureau pilote, membres et parents suivent simplement. Un compte, plusieurs clubs.",
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
