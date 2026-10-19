/**
 * Catalogue FR — invitations / rejoindre (portail).
 * Aligné sur `AppCopy.join` (Flutter) pour les messages de partage.
 * Les e-mails transactionnels Guy vivent dans `functions/src/email/emailCopy.ts`.
 */

import { TeamInviteLimits } from "@/lib/firebase/constants";

/** Messages WhatsApp / SMS / presse-papiers. */
export const joinCopy = {
  defaultChildName: "ton enfant",
  close: "Fermer",
  loadingTeamCode: "Chargement du code…",
  teamInviteCreateFailed: "Impossible de créer le code d’équipe.",
  teamInviteRevokeFailed: "Impossible de révoquer le code.",
  inviteAcceptFailed: "Impossible d’accepter l’invitation.",
  teamFallback: "l’équipe",
  joinTeamEyebrow: "Rejoindre une équipe",
  joinTeamTitle: (teamLabel: string) => `Rejoindre ${teamLabel}`,
  joinTeamLead: (teamLabel: string, clubName: string) =>
    `Tu vas rejoindre ${teamLabel} (${clubName}). Crée un compte ou connecte-toi, puis c’est direct.`,
  acceptingTeam: (teamLabel: string) => `On t’ajoute à ${teamLabel}…`,
  validatingInviteTitle: "Validation de l’invitation",
  teamInviteFallbackLead: "Invitation d’équipe.",
  clubInviteMessage: (params: {
    clubName: string;
    code: string;
    joinUrl: string;
    appStoreUrl: string;
    playStoreUrl: string;
    siteUrl: string;
  }) =>
    `Salut !

On t'attend. Voilà ton code pour rejoindre ${params.clubName} sur ViroTeam.

Ton code : ${params.code}
Valable 7 jours.
App Store : ${params.appStoreUrl}
Google Play : ${params.playStoreUrl}

Ou ouvre l'app → « J'ai un code d'invitation » et tape ce code.

Aussi sur le web :
Site : ${params.siteUrl}
Espace club : ${params.joinUrl}

— Guy`,
  guardianInviteShareMessage: (params: {
    childFirstName: string;
    clubName: string;
    code: string;
    joinUrl: string;
    appStoreUrl: string;
    playStoreUrl: string;
    siteUrl: string;
  }) =>
    `Salut !

Tu pourras voir le planning de ${params.childFirstName}, répondre aux convocations et payer la cotisation — ${params.clubName}.

Ton code : ${params.code}
Valable 7 jours.
App Store : ${params.appStoreUrl}
Google Play : ${params.playStoreUrl}

Ou ouvre l'app → « J'ai un code d'invitation » et tape ce code.

Aussi sur le web :
Site : ${params.siteUrl}
Espace club : ${params.joinUrl}

— Guy`,
  inviteTeamTitle: "Inviter l’équipe",
  inviteTeamSubtitle:
    "Partage ce code : tes joueurs rejoignent le club et l’équipe directement.",
  shareTeamCode: "Partager le lien",
  copyTeamCode: "Copier le code",
  regenerateTeamCode: "Régénérer",
  revokeTeamCode: "Révoquer",
  teamCodeCopied: "Code copié.",
  teamLinkCopied: "Lien copié.",
  teamCodeRevoked: "Code révoqué.",
  teamInviteUses: (useCount: number, maxUses: number) =>
    `${useCount} / ${maxUses} utilisations`,
  teamInviteExpires: (dateLabel: string) => `Valable jusqu’au ${dateLabel}`,
  teamInviteShareMessage: (params: {
    clubName: string;
    teamName: string;
    code: string;
    joinUrl: string;
    appStoreUrl: string;
    playStoreUrl: string;
    siteUrl: string;
  }) =>
    `Salut !

Rejoins ${params.teamName} (${params.clubName}) sur ViroTeam pour les convocations.

Ton code : ${params.code}
Valable ${TeamInviteLimits.ttlDays} jours (max ${TeamInviteLimits.maxUses} joueurs via ce lien).
App Store : ${params.appStoreUrl}
Google Play : ${params.playStoreUrl}

Ou ouvre l'app → « J'ai un code d'invitation » et tape ce code.

Aussi sur le web :
Site : ${params.siteUrl}
Espace club : ${params.joinUrl}

— Guy`,
} as const;
