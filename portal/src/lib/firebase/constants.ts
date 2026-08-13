/** Collections Firestore alignées sur ProjectConfig Flutter. */
export const Collections = {
  users: "users",
  clubs: "clubs",
  members: "members",
  memberAccounts: "member_accounts",
  events: "events",
  feeSeasons: "fee_seasons",
  memberFees: "member_fees",
  teams: "teams",
  invitations: "invitations",
} as const;

/** Noms de champs Firestore alignés sur FirestoreFields Flutter. */
export const Fields = {
  uid: "uid",
  email: "email",
  emailNorm: "emailNorm",
  firstName: "firstName",
  lastName: "lastName",
  displayName: "displayName",
  phone: "phone",
  avatarUrl: "avatarUrl",
  clubMemberships: "clubMemberships",
  flags: "flags",
  profileCompleted: "profileCompleted",
  disabled: "disabled",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  clubId: "clubId",
  role: "role",
  name: "name",
  adminIds: "adminIds",
  memberCount: "memberCount",
  helloAssoOrganizationSlug: "helloAssoOrganizationSlug",
  onlinePaymentEnabled: "onlinePaymentEnabled",
  seasonEndDate: "seasonEndDate",
  seasonLabel: "seasonLabel",
  isActive: "isActive",
  currency: "currency",
  paymentDeadlineAt: "paymentDeadlineAt",
  paymentInstructions: "paymentInstructions",
  paymentMethods: "paymentMethods",
  iban: "iban",
  tiers: "tiers",
  tierId: "tierId",
  amountCents: "amountCents",
  label: "label",
  createdBy: "createdBy",
  /** Champ `status` dans `member_fees` (a_payer, partiel, paye, exonere). */
  feeStatus: "status",
  paidAt: "paidAt",
  paidVia: "paidVia",
  paymentProvider: "paymentProvider",
  amountPaidCents: "amountPaidCents",
  aids: "aids",
  title: "title",
  type: "type",
  location: "location",
  date: "date",
  dateId: "dateId",
  startTime: "startTime",
  endTime: "endTime",
  meetingTime: "meetingTime",
  matchVenue: "matchVenue",
  teamIds: "teamIds",
  allTeams: "allTeams",
  teamMemberIds: "teamMemberIds",
  playerIds: "playerIds",
  coachIds: "coachIds",
  category: "category",
  rsvp: "rsvp",
  attendance: "attendance",
  creatorId: "creatorId",
  seriesId: "seriesId",
  canceled: "canceled",
  memberId: "memberId",
  accountUid: "accountUid",
  /** Legacy fondateurs / membres inscrits avant accountUid. */
  userId: "userId",
  code: "code",
  /** Champ `status` dans `invitations` (pending, accepted, declined, expired). */
  status: "status",
  clubName: "clubName",
  clubSport: "clubSport",
  sport: "sport",
  snapshot: "snapshot",
  activeInvitationId: "activeInvitationId",
  playerInfo: "playerInfo",
  license: "license",
  coachInfo: "coachInfo",
  headCoach: "headCoach",
  expiresAt: "expiresAt",
  sentBy: "sentBy",
  sentAt: "sentAt",
  joinedAt: "joinedAt",
} as const;

/** Rôles membre club. */
export const MemberRoles = {
  admin: "admin",
  coach: "coach",
  player: "player",
} as const;

/** Statuts cotisation member_fees. */
export const MemberFeeStatuses = {
  aPayer: "a_payer",
  partiel: "partiel",
  paye: "paye",
  exonere: "exonere",
} as const;

/** Clé localStorage du club actif. */
export const ACTIVE_CLUB_STORAGE_KEY = "viro.activeClubId";

/** Statuts invitation (aligné InvitationStatus Flutter). */
export const InvitationStatus = {
  pending: "pending",
  accepted: "accepted",
  declined: "declined",
  expired: "expired",
} as const;
