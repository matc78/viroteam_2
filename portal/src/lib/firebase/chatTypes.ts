import {
  ChatConversationTypes,
  ChatMessageTypes,
  ChatWritePolicies,
} from "./constants";

/** Option d’un sondage chat. */
export type ChatPollOption = {
  id: string;
  text: string;
};

/** Conversation club (`clubs/{clubId}/conversations/{convId}`). */
export type ChatConversation = {
  id: string;
  clubId: string;
  type: string;
  title: string;
  titleOverride: string | null;
  systemKey: string | null;
  teamId: string | null;
  categoryKey: string | null;
  participantUids: string[];
  writePolicy: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string;
  lastSenderUid: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/** Message d’une conversation. */
export type ChatMessage = {
  id: string;
  conversationId: string;
  clubId: string;
  type: string;
  text: string | null;
  storagePath: string | null;
  downloadUrl: string | null;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  senderUid: string;
  createdAt: Date;
  deletedAt: Date | null;
  deletedByUid: string | null;
  reactions: Record<string, string[]>;
  pollQuestion: string | null;
  pollOptions: ChatPollOption[];
  pollVotes: Record<string, string[]>;
  pollAllowMultiple: boolean;
};

/** État chat local (`users/{uid}/chatState/{clubId}_{convId}`). */
export type ChatUserState = {
  id: string;
  muted: boolean;
  lastReadAt: Date | null;
  unreadCount: number;
};

/** Identifiant d’un thread ouvert (fenêtre / page). */
export type ChatThreadKey = {
  clubId: string;
  conversationId: string;
};

/** Titre affiché (override si présent). */
export function chatDisplayTitle(conversation: ChatConversation): string {
  const override = conversation.titleOverride?.trim();
  if (override) return override;
  return conversation.title || "Discussion";
}

/** Id doc chatState. */
export function chatStateDocId(clubId: string, conversationId: string): string {
  return `${clubId}_${conversationId}`;
}

/** True si le message est soft-deleted. */
export function isChatMessageDeleted(message: ChatMessage): boolean {
  return message.deletedAt != null;
}

/** Total de votes (toutes options). */
export function pollTotalVotes(message: ChatMessage): number {
  let total = 0;
  for (const voters of Object.values(message.pollVotes)) {
    total += voters.length;
  }
  return total;
}

/** Nombre de votants uniques. */
export function pollUniqueVoterCount(message: ChatMessage): number {
  const uids = new Set<string>();
  for (const voters of Object.values(message.pollVotes)) {
    for (const uid of voters) uids.add(uid);
  }
  return uids.size;
}

/** True si uid a voté pour optionId. */
export function hasVotedFor(
  message: ChatMessage,
  uid: string,
  optionId: string,
): boolean {
  return message.pollVotes[optionId]?.includes(uid) ?? false;
}

export {
  ChatConversationTypes,
  ChatMessageTypes,
  ChatWritePolicies,
};
