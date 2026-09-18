/**
 * Catalogue FR — invitations / rejoindre (portail).
 * Aligné sur `AppCopy.join` (Flutter) pour les messages de partage.
 * Les e-mails transactionnels Guy vivent dans `functions/src/email/emailCopy.ts`.
 */

/** Messages WhatsApp / SMS / presse-papiers. */
export const joinCopy = {
  defaultChildName: "ton enfant",
  playStoreLabel: "App Android :",
  clubInviteMessage: (params: {
    clubName: string;
    code: string;
    joinUrl: string;
    storeLine: string;
  }) =>
    `Salut !

On t'attend. Voilà ton code pour rejoindre ${params.clubName} sur ViroTeam.

Ton code : ${params.code}
Valable 7 jours.
Lien : ${params.joinUrl}${params.storeLine}

Ou ouvre l'app → « J'ai un code d'invitation » et tape ce code.

— Guy`,
  guardianInviteShareMessage: (params: {
    childFirstName: string;
    clubName: string;
    code: string;
  }) =>
    `Salut !

Tu pourras voir le planning de ${params.childFirstName}, répondre aux convocations et payer la cotisation — ${params.clubName}.

Ton code : ${params.code}
Valable 7 jours.

Ouvre l'app → « J'ai un code d'invitation » et tape ce code.

— Guy`,
} as const;
