export type {
  BuiltEmail,
  GuyEmailClub,
  GuyEmailParams,
  GuardianInviteEmailParams,
  InviteAcceptedGuardianEmailParams,
  InviteAcceptedMemberEmailParams,
  MemberInviteEmailParams,
  MemberInviteRole,
} from "./types";
export {
  APP_LOGO_URL,
  emailCtaButton,
  emailInviteCodeBlock,
  wrapGuyEmailLayout,
} from "./layout";
export { buildGuyEmail, normalizeMemberInviteRole } from "./guyCopy";
export { emailCopy } from "./emailCopy";
export {
  brevoApiKey,
  brevoCallableSecrets,
  brevoSenderEmail,
  brevoSenderName,
  buildJoinUrl,
  clubLogoUrlFromData,
  configuredPlayStoreUrl,
  inviteJoinBaseUrl,
  playStoreUrl,
  resolveAuthEmail,
  sendGuyTransactionalEmail,
  trySendGuyTransactionalEmail,
} from "./sendTransactional";
