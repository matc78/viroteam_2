/** Collections Firestore alignées sur ProjectConfig Flutter. */
export const Collections = {
  users: "users",
  clubs: "clubs",
  retourUser: "retour_user",
  members: "members",
  memberAccounts: "member_accounts",
  events: "events",
  feeSeasons: "fee_seasons",
  memberFees: "member_fees",
  teams: "teams",
  invitations: "invitations",
  guardians: "guardians",
  announcements: "announcements",
  equipment: "equipment",
} as const;

/** Noms de champs Firestore alignés sur FirestoreFields Flutter. */
export const Fields = {
  id: "id",
  uid: "uid",
  email: "email",
  emailNorm: "emailNorm",
  firstName: "firstName",
  lastName: "lastName",
  displayName: "displayName",
  phone: "phone",
  avatarUrl: "avatarUrl",
  logoUrl: "logoUrl",
  coachPermissions: "coachPermissions",
  canCreateEvents: "canCreateEvents",
  canManageTeamRoster: "canManageTeamRoster",
  canInvitePlayers: "canInvitePlayers",
  canTakeAttendance: "canTakeAttendance",
  canViewFees: "canViewFees",
  clubMemberships: "clubMemberships",
  parentLinks: "parentLinks",
  parentClubIds: "parentClubIds",
  parentTeamIds: "parentTeamIds",
  relation: "relation",
  parentUid: "parentUid",
  invitedBy: "invitedBy",
  revokedAt: "revokedAt",
  permissions: "permissions",
  canView: "canView",
  canRsvp: "canRsvp",
  canPay: "canPay",
  acceptedBy: "acceptedBy",
  acceptedAt: "acceptedAt",
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
  offlineMethod: "offlineMethod",
  markedBy: "markedBy",
  memberDisplayName: "memberDisplayName",
  validatedBy: "validatedBy",
  validatedAt: "validatedAt",
  promoCode: "promoCode",
  notesAdmin: "notesAdmin",
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
  pendingPlayerIds: "pendingPlayerIds",
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
  city: "city",
  postalCode: "postalCode",
  address: "address",
  description: "description",
  brandColorHex: "brandColorHex",
  practiceLocations: "practiceLocations",
  objectives: "objectives",
  objectivesLabels: "objectivesLabels",
  memberCountRange: "memberCountRange",
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
  message: "message",
  senderId: "senderId",
  senderFirstName: "senderFirstName",
  senderLastName: "senderLastName",
  targetType: "targetType",
  targetIds: "targetIds",
  endsAt: "endsAt",
  closedAt: "closedAt",
  closedBy: "closedBy",
  quantity: "quantity",
  condition: "condition",
  assignedTeamId: "assignedTeamId",
  notes: "notes",
  updatedBy: "updatedBy",
} as const;

/** États d’un item d’inventaire. */
export const EquipmentConditions = {
  ok: "ok",
  use: "use",
  hs: "hs",
} as const;

export type EquipmentCondition =
  (typeof EquipmentConditions)[keyof typeof EquipmentConditions];

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

/** Statuts justificatif d'aide cotisation. */
export const FeeAidStatuses = {
  pendingProof: "pending_proof",
  validated: "validated",
  rejected: "rejected",
} as const;

/** Canal de règlement cotisation. */
export const FeePaidVia = {
  offline: "offline",
  manual: "manual",
  helloasso: "helloasso",
  inApp: "in_app",
} as const;

/** Moyens hors-ligne acceptés (aligné Flutter FeePaymentMethods.offline). */
export const OfflinePaymentMethods = [
  "virement",
  "cheque",
  "especes",
  "ancv",
  "cheques_vacances",
] as const;

export type OfflinePaymentMethod = (typeof OfflinePaymentMethods)[number];

/** Clé localStorage du club actif. */
export const ACTIVE_CLUB_STORAGE_KEY = "viro.activeClubId";

/** Clé localStorage de l’espace (bureau vs famille). */
export const ACTIVE_SPACE_STORAGE_KEY = "viro.activeSpace";

/** V1 : un guardian active/pending par fiche enfant. */
export const MAX_ACTIVE_GUARDIANS_PER_MEMBER = 1;

/** Statuts invitation (aligné InvitationStatus Flutter). */
export const InvitationStatus = {
  pending: "pending",
  accepted: "accepted",
  declined: "declined",
  expired: "expired",
} as const;

/** `invitations.type` — membre du roster vs rattachement parent. */
export const InvitationTypes = {
  member: "member",
  guardian: "guardian",
} as const;

/** `guardians.relation` / `parentLinks.relation`. V1 : uniquement parent. */
export const GuardianRelations = {
  parent: "parent",
  grandparent: "grandparent",
  tutor: "tutor",
} as const;

/** `guardians.status` / `parentLinks.status`. */
export const GuardianStatuses = {
  pending: "pending",
  active: "active",
  revoked: "revoked",
} as const;

/** Ciblage des annonces club (aligné AnnouncementTargetTypes Flutter). */
export const AnnouncementTargetTypes = {
  allMembers: "Tous les membres",
  teams: "Équipes",
  categories: "Catégories",
  people: "Personnes",
} as const;
