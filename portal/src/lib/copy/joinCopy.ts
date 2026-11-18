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
  confirmTeamJoinLead: (teamLabel: string, clubName: string) =>
    `Tu vas rejoindre ${teamLabel} (${clubName}). Vérifie que c’est le bon compte avant de valider.`,
  confirmTeamJoin: "Rejoindre",
  signedInAs: "Connecté avec",
  switchAccount: "Changer de compte",
  switchingAccount: "Déconnexion…",
  declineJoin: "Pas maintenant",
  validatingInviteTitle: "Validation de l’invitation",
  /** Échec de la recherche du code, par cause. */
  lookupMissingCodeTitle: "Code manquant",
  lookupMissingCodeLead:
    "Demande ton code d’invitation à l’admin ou à ton entraîneur, puis réessaie.",
  /** Saisie manuelle du code (Espace club, non connecté). */
  enterCodeEyebrow: "Rejoindre un club",
  enterCodeTitle: "J’ai un code d’invitation",
  enterCodeLead:
    "Entre le code reçu de ton club. On te montrera ensuite l’invitation avant de créer ton compte.",
  enterCodeLabel: "Code d’invitation",
  enterCodePlaceholder: "Ex. ASMP1K2E",
  enterCodeSubmit: "Continuer",
  enterCodeRequired: "Le code d’invitation est requis.",
  enterCodeTooShort: "Ce code est trop court.",
  lookupNotFoundTitle: "Code introuvable",
  lookupNotFoundLead:
    "Ce code n’existe pas. Vérifie qu’il est bien recopié, ou demande un nouveau code à ton club.",
  lookupExpiredTitle: "Code expiré",
  lookupExpiredLead:
    "Ce code n’est plus valable. Demande un nouveau code à ton club.",
  lookupExhaustedTitle: "Code complet",
  lookupExhaustedLead:
    "Ce code a atteint son nombre maximum d’utilisations. Demande un nouveau code à ton club.",
  lookupErrorTitle: "Vérification impossible",
  lookupErrorLead:
    "On n’a pas pu vérifier ton code (connexion ou service indisponible). Réessaie dans un instant.",
  lookupRetry: "Réessayer",
  lookupSignInHint: "Tu peux te connecter sur le portail si tu as déjà un compte.",
  lookupBackToSignIn: "Retour à la connexion",
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
