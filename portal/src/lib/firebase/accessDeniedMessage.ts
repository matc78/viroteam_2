/** Formate une liste de noms pour une phrase en français. */
export function formatClubList(names: string[]): string {
  const filtered = names.map((name) => name.trim()).filter(Boolean);
  if (filtered.length === 0) return "";
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]} et ${filtered[1]}`;
  const last = filtered[filtered.length - 1];
  return `${filtered.slice(0, -1).join(", ")} et ${last}`;
}

/** Message d’accès refusé personnalisé (ton sportif). */
export function buildAccessDeniedLead(params: {
  firstName: string;
  clubNames: string[];
  fromSignup?: boolean;
  /** Compte inconnu ou joueur/coach : message app, session fermée. */
  forceAppMessage?: boolean;
}): string {
  const firstName = params.firstName.trim() || "champion";
  const clubsLabel = formatClubList(params.clubNames);
  const multipleClubs = params.clubNames.length > 1;
  const possessive = multipleClubs ? "tes" : "ton";
  const clubWord = multipleClubs ? "clubs" : "club";

  if (params.forceAppMessage) {
    return `Désolé ${firstName}, cette partie est réservée aux admins de club. Pour jouer, coacher ou suivre ton équipe, ouvre l’application mobile.`;
  }

  if (params.fromSignup) {
    if (clubsLabel) {
      return `Bienvenue ${firstName} ! Pour créer ou rejoindre un club, c’est sur l’app mobile. Le portail web, c’est le banc des admins de ${possessive} ${clubWord}.`;
    }
    return `Bienvenue ${firstName} ! Pour créer ou rejoindre un club, c’est sur l’app mobile. Le portail web, c’est le banc des admins.`;
  }

  if (clubsLabel) {
    return `Désolé ${firstName} de ${clubsLabel}, cette partie est réservée aux admins de ${possessive} ${clubWord}. Pour jouer, coacher ou suivre ton équipe, ouvre l’application mobile.`;
  }

  return `Désolé ${firstName}, cette partie est réservée aux admins de club. Pour jouer, coacher ou suivre ton équipe, ouvre l’application mobile.`;
}

/** Titre de l’écran accès refusé. */
export function buildAccessDeniedTitle(params?: {
  fromSignup?: boolean;
  needsJoinOnboarding?: boolean;
  forceAppMessage?: boolean;
}): string {
  if (params?.forceAppMessage) {
    return "Pas sur ce terrain";
  }
  if (params?.needsJoinOnboarding) {
    return params.fromSignup ? "Compte créé, bienvenue !" : "Rejoins ton équipe";
  }
  return params?.fromSignup ? "Compte créé, bienvenue !" : "Pas sur ce terrain";
}

/** Sous-titre pour l’onboarding rejoindre un club (sans adhésion). */
export function buildJoinOnboardingLead(firstName: string): string {
  const name = firstName.trim() || "champion";
  return `Allez ${name}, complète ton profil et entre le code d’invitation de ton club. On te redirige ensuite vers l’app pour valider ton entrée dans l’équipe.`;
}
