import type {
  ChatConversation,
  ChatMessage,
  ChatUserState,
} from "@/lib/firebase/chatTypes";

/** Conversation minimale pour les tests (champs surchargeables). */
export function makeConversation(
  overrides: Partial<ChatConversation> = {},
): ChatConversation {
  return {
    id: "conv1",
    clubId: "club1",
    type: "team",
    title: "",
    titleOverride: null,
    avatarUrl: null,
    systemKey: null,
    teamId: null,
    categoryKey: null,
    participantUids: ["me", "other"],
    participantProfiles: {},
    writePolicy: "open",
    lastMessageAt: null,
    lastMessagePreview: "",
    lastSenderUid: null,
    lastSenderFirstName: null,
    lastSenderRole: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

/** Message texte minimal pour les tests (champs surchargeables). */
export function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "conv1",
    clubId: "club1",
    type: "text",
    text: "Salut",
    storagePath: null,
    downloadUrl: null,
    thumbUrl: null,
    width: null,
    height: null,
    senderUid: "other",
    createdAt: new Date(2026, 10, 3, 10, 0),
    deletedAt: null,
    deletedByUid: null,
    editedAt: null,
    reactions: {},
    pollQuestion: null,
    pollOptions: [],
    pollVotes: {},
    pollAllowMultiple: false,
    replyToMessageId: null,
    replyToText: null,
    replyToSenderUid: null,
    ...overrides,
  };
}

/** État chat utilisateur minimal pour les tests. */
export function makeChatState(
  overrides: Partial<ChatUserState> = {},
): ChatUserState {
  return {
    id: "club1_conv1",
    muted: false,
    favorite: false,
    lastReadAt: null,
    unreadCount: 0,
    ...overrides,
  };
}
