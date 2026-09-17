import { extractUrlsFromText } from "@/lib/chat/linkifyMessageText";
import {
  ChatMessageTypes,
  isChatMessageDeleted,
  type ChatMessage,
} from "@/lib/firebase/chatTypes";

/** Photo partagée dans une discussion. */
export type ChatMediaImage = {
  messageId: string;
  url: string;
  createdAt: Date;
};

/** Lien partagé dans une discussion. */
export type ChatMediaLink = {
  messageId: string;
  url: string;
  createdAt: Date;
};

/** Agrège photos et liens depuis les messages chargés. */
export function extractConversationMedia(messages: ChatMessage[]): {
  images: ChatMediaImage[];
  links: ChatMediaLink[];
} {
  const images: ChatMediaImage[] = [];
  const links: ChatMediaLink[] = [];
  const seenLinks = new Set<string>();

  for (const message of messages) {
    if (isChatMessageDeleted(message)) continue;
    if (message.type === ChatMessageTypes.image) {
      const url = message.thumbUrl || message.downloadUrl;
      if (url) {
        images.push({
          messageId: message.id,
          url,
          createdAt: message.createdAt,
        });
      }
      continue;
    }
    if (message.type === ChatMessageTypes.text && message.text) {
      for (const url of extractUrlsFromText(message.text)) {
        if (seenLinks.has(url)) continue;
        seenLinks.add(url);
        links.push({
          messageId: message.id,
          url,
          createdAt: message.createdAt,
        });
      }
    }
  }

  images.reverse();
  links.reverse();
  return { images, links };
}
