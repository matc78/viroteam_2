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
  /** Title SERP : marque + intention. */
  seoTitle:
    "ViroTeam — App de gestion de club sportif | Planning, convocations, cotisations",
  /** Meta description SERP (~150 car. pour Google / Bing). */
  seoDescription:
    "ViroTeam — logiciel et app de gestion pour clubs sportifs : planning, convocations, cotisations, membres. Bureau, coachs, joueurs et parents. Multiclub.",
  /**
   * Mots-clés ciblés (Bing / données structurées).
   * Google ignore la balise keywords : on les réutilise dans titres, FAQ et JSON-LD.
   */
  seoKeywords: [
    "ViroTeam",
    "Viro Team",
    "viroteam",
    "application gestion club sport",
    "app gestion club amateur",
    "app club sportif",
    "logiciel gestion club sportif",
    "logiciel association sportive",
    "outil gestion association sportive",
    "gestion club sportif",
    "gestion équipe sportive",
    "organisation club sportif",
    "planning club sport",
    "calendrier entraînements club",
    "calendrier entraînements matchs",
    "convocations club sport",
    "convocation match RSVP",
    "suivi cotisations club",
    "gestion cotisations club",
    "cotisations association sportive",
    "gestion membres club",
    "gestion membres club sport",
    "licences club sport",
    "gestion licences sportives",
    "gestion équipes catégories",
    "app coach club",
    "application coach équipe",
    "application parents club sport",
    "app parents club sport",
    "espace bureau club",
    "portail gestion club",
    "multiclub",
    "application multiclub",
    "invitation membres club",
    "application volleyball club",
    "gestion club volleyball",
    "app club amateur Android",
  ],
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
