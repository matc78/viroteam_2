import { sortInboxConversations } from "@/lib/firebase/chatService";
import {
  chatStateDocId,
  type ChatConversation,
  type ChatUserState,
} from "@/lib/firebase/chatTypes";

/**
 * Inbox triée (favoris puis récence) et filtrée par la recherche :
 * titre affiché (override, nom du pair DM, titre), nom du club ou aperçu
 * du dernier message, sans casse. Recherche vide → toute l’inbox triée.
 */
export function filterInbox(params: {
  conversations: ChatConversation[];
  chatStates: Record<string, ChatUserState>;
  query: string;
  clubNameById: Record<string, string>;
  dmPeerNameByKey: Record<string, string>;
}): ChatConversation[] {
  const { conversations, chatStates, query, clubNameById, dmPeerNameByKey } =
    params;
  const sorted = sortInboxConversations(conversations, chatStates);
  const q = query.trim().toLowerCase();
  if (!q) return sorted;
  return sorted.filter((conversation) => {
    const stateId = chatStateDocId(conversation.clubId, conversation.id);
    const title = (
      conversation.titleOverride ||
      dmPeerNameByKey[stateId] ||
      conversation.title ||
      ""
    ).toLowerCase();
    const club = (clubNameById[conversation.clubId] ?? "").toLowerCase();
    const preview = conversation.lastMessagePreview.toLowerCase();
    return title.includes(q) || club.includes(q) || preview.includes(q);
  });
}
