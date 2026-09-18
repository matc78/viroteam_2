/**
 * Catalogue FR des e-mails transactionnels (persona Guy).
 *
 * Même rôle qu’`AppCopy` côté Flutter : tous les libellés ici, pas dans
 * les builders HTML. Prêt pour une future locale (ex. `emailCopyEn`).
 *
 * Règle club : jamais de préposition avant le nom (au / de / à l’) —
 * marche pour « le club », « l'USMV », « Association … », etc.
 */

/** Libellés communs (signature, code, CTA, fallbacks). */
export const emailCopyCommon = {
  brandName: "ViroTeam",
  siteHost: "viroteam.com",
  siteUrl: "https://www.viroteam.com",
  signOff: "— Guy",
  footerSignature: "Guy, du club via ViroTeam",
  greetingAnonymous: "Salut,",
  greetingNamed: (firstName: string) => `Salut ${firstName},`,
  codeLabel: "Ton code",
  codeValidDays: "Valable 7 jours.",
  linkPrefix: "Lien :",
  ctaOpenInvite: "Ouvrir l'invitation",
  fallbackAppCode:
    "Ou ouvre l'app → « J'ai un code d'invitation » et tape ce code.",
  playStoreLabel: "App Android :",
  playStoreDownload: "télécharger",
  defaultChildName: "ton enfant",
  defaultSomeone: "Quelqu'un",
  defaultParent: "Un parent",
  defaultChildFallback: "l'enfant",
  rolePlayer: "joueur",
  roleCoach: "coach",
  roleAdmin: "admin",
} as const;

type ClubLead = {
  subject: (clubName: string) => string;
  /** Texte brut (preheader + plain text). */
  lead: (clubName: string) => string;
  /** Parties autour du nom de club pour le HTML (strong). */
  leadAroundClub: { before: string; after: string };
};

/** Invitation membre — variantes par rôle. */
export const emailCopyMemberInvite: Record<
  "player" | "coach" | "admin",
  ClubLead
> = {
  player: {
    subject: (clubName) => `Allez, rejoins ${clubName} — Guy`,
    lead: (clubName) =>
      `On t'attend. Voilà ton code pour rejoindre ${clubName} sur ViroTeam.`,
    leadAroundClub: {
      before: "On t'attend. Voilà ton code pour rejoindre ",
      after: " sur ViroTeam.",
    },
  },
  coach: {
    subject: (clubName) => `On a besoin de toi — ${clubName} — Guy`,
    lead: (clubName) =>
      `On a besoin de toi. Voilà ton code pour rejoindre ${clubName} côté coach.`,
    leadAroundClub: {
      before: "On a besoin de toi. Voilà ton code pour rejoindre ",
      after: " côté coach.",
    },
  },
  admin: {
    subject: (clubName) => `On te passe les clés — ${clubName} — Guy`,
    lead: (clubName) =>
      `On te passe les clés. Avec ça tu gères ${clubName} sur ViroTeam.`,
    leadAroundClub: {
      before: "On te passe les clés. Avec ça tu gères ",
      after: " sur ViroTeam.",
    },
  },
};

/** Invitation parent. */
export const emailCopyGuardianInvite = {
  subject: (childFirstName: string, clubName: string) =>
    `Pour suivre ${childFirstName} — ${clubName}`,
  lead: (childFirstName: string, clubName: string) =>
    `Tu pourras voir le planning de ${childFirstName}, répondre aux convocations et payer la cotisation — ${clubName}.`,
  leadBeforeChild: "Tu pourras voir le planning de ",
  leadBetweenChildAndClub:
    ", répondre aux convocations et payer la cotisation — ",
  leadAfterClub: ".",
} as const;

/** Confirmation à l’inviteur — membre a accepté. */
export const emailCopyInviteAcceptedMember = {
  subject: (memberDisplayName: string, clubName: string) =>
    `${memberDisplayName} a rejoint ${clubName}`,
  lead: (memberDisplayName: string, roleLabel: string, clubName: string) =>
    `${memberDisplayName} a accepté l'invitation (${roleLabel}) pour ${clubName}. C'est bon, c'est dans la boîte.`,
  leadAfterName: " a accepté l'invitation (",
  leadBetweenRoleAndClub: ") pour ",
  leadClosing: ".",
  closingLine: "C'est bon, c'est dans la boîte.",
} as const;

/** Confirmation à l’inviteur — parent a lié. */
export const emailCopyInviteAcceptedGuardian = {
  subject: (parentDisplayName: string, childFirstName: string, clubName: string) =>
    `${parentDisplayName} suit maintenant ${childFirstName} — ${clubName}`,
  lead: (parentDisplayName: string, childFirstName: string, clubName: string) =>
    `${parentDisplayName} suit maintenant ${childFirstName} (${clubName}). Planning, convocations, cotisation : c'est branché.`,
  leadBetweenParentAndChild: " suit maintenant ",
  leadBetweenChildAndClub: " (",
  leadAfterClub: "). Planning, convocations, cotisation : c'est branché.",
} as const;

/** Point d’entrée unique (comme `AppCopy`). */
export const emailCopy = {
  common: emailCopyCommon,
  memberInvite: emailCopyMemberInvite,
  guardianInvite: emailCopyGuardianInvite,
  inviteAcceptedMember: emailCopyInviteAcceptedMember,
  inviteAcceptedGuardian: emailCopyInviteAcceptedGuardian,
} as const;
