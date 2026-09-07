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
  /** Compte sans accès bureau/famille : message d’orientation. */
  forceAppMessage?: boolean;
}): string {
  const firstName = params.firstName.trim() || "champion";
  const clubsLabel = formatClubList(params.clubNames);
  const multipleClubs = params.clubNames.length > 1;
  const possessive = multipleClubs ? "tes" : "ton";
  const clubWord = multipleClubs ? "clubs" : "club";

  if (params.forceAppMessage) {
    return `Désolé ${firstName}, cet espace n’est pas accessible avec ce compte. Rejoins un club via un code d’invitation, crée un club, ou ouvre l’app si tu as déjà un accès mobile.`;
  }

  if (params.fromSignup) {
    if (clubsLabel) {
      return `Bienvenue ${firstName} ! Pour rejoindre ${possessive} ${clubWord} avec un code, utilise le formulaire ou le lien d’invitation.`;
    }
    return `Bienvenue ${firstName} ! Entre ton code d’invitation pour rejoindre ton club, ou crée un club si tu es fondateur.`;
  }

  if (clubsLabel) {
    return `Désolé ${firstName} de ${clubsLabel}, impossible d’ouvrir cet espace pour le moment. Réessaie ou contacte ton club.`;
  }

  return `Désolé ${firstName}, cet espace n’est pas accessible. Rejoins un club avec un code d’invitation ou crée un club.`;
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
  return `Allez ${name}, complète ton profil et entre le code d’invitation de ton club pour rejoindre l’équipe sur le portail.`;
}
