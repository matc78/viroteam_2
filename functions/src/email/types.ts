/** Rôles couverts par les mails d’invitation membre. */
export type MemberInviteRole = "player" | "coach" | "admin";

/** Contenu prêt pour Brevo. */
export type BuiltEmail = {
  subject: string;
  textContent: string;
  htmlContent: string;
  tags: string[];
};

/** Params communs à tous les mails Guy. */
export type GuyEmailClub = {
  clubId: string;
  clubName: string;
  /** URL publique Storage ; absente → pas d’image club dans le body. */
  clubLogoUrl?: string;
};

export type MemberInviteEmailParams = GuyEmailClub & {
  kind: "memberInvite";
  role: MemberInviteRole;
  firstName: string;
  code: string;
  joinUrl: string;
  playStoreUrl?: string;
};

export type GuardianInviteEmailParams = GuyEmailClub & {
  kind: "guardianInvite";
  childFirstName: string;
  code: string;
  joinUrl: string;
  playStoreUrl?: string;
};

export type InviteAcceptedMemberEmailParams = GuyEmailClub & {
  kind: "inviteAcceptedMember";
  memberDisplayName: string;
  role: MemberInviteRole;
};

export type InviteAcceptedGuardianEmailParams = GuyEmailClub & {
  kind: "inviteAcceptedGuardian";
  parentDisplayName: string;
  childFirstName: string;
};

export type GuyEmailParams =
  | MemberInviteEmailParams
  | GuardianInviteEmailParams
  | InviteAcceptedMemberEmailParams
  | InviteAcceptedGuardianEmailParams;
