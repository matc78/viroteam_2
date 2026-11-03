import { formatChatMessageTime } from "@/lib/chat/formatChatMessageTime";
import { ChatMessageTypes } from "@/lib/firebase/constants";
import {
  isChatMessageDeleted,
  type ChatMessage,
} from "@/lib/firebase/chatTypes";

/** Tri chronologique (plus ancien en tête). */
function byCreatedAt(a: ChatMessage, b: ChatMessage): number {
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/** Texte court pour la citation d’un message. */
export function replyPreviewText(message: ChatMessage): string {
  if (message.type === ChatMessageTypes.poll) {
    return message.pollQuestion || message.text || "Sondage";
  }
  if (message.type === ChatMessageTypes.image) return "Photo";
  return (message.text ?? "").trim();
}

/** Champs de citation joints à un envoi (vide si pas de cible citable). */
export type ReplyPayload = {
  replyToMessageId?: string;
  replyToText?: string;
  replyToSenderUid?: string;
};

/**
 * Citation à joindre à un envoi : rien si pas de cible, cible supprimée
 * ou sans texte citable ; extrait limité à 240 caractères.
 */
export function replyPayloadFromTarget(
  target: ChatMessage | null,
): ReplyPayload {
  if (!target || isChatMessageDeleted(target)) return {};
  const preview = replyPreviewText(target);
  if (!preview) return {};
  return {
    replyToMessageId: target.id,
    replyToText: preview.slice(0, 240),
    replyToSenderUid: target.senderUid,
  };
}

/** Libellé horodatage (+ « modifié » si besoin). */
export function messageTimeLabel(message: ChatMessage): string {
  const time = formatChatMessageTime(message.createdAt);
  return message.editedAt ? `modifié ${time}` : time;
}

/**
 * Fusionne l’historique paginé et la fenêtre temps réel (le temps réel gagne
 * à id égal), triés du plus ancien au plus récent.
 */
export function mergeThreadMessages(
  olderMessages: ChatMessage[],
  realtimeMessages: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of olderMessages) byId.set(message.id, message);
  for (const message of realtimeMessages) byId.set(message.id, message);
  return [...byId.values()].sort(byCreatedAt);
}

/**
 * Ajoute une page d’historique aux messages anciens déjà chargés
 * (sans doublon, les existants gardent la priorité), triés chronologiquement.
 */
export function appendOlderPage(
  current: ChatMessage[],
  page: ChatMessage[],
): ChatMessage[] {
  const ids = new Set(current.map((message) => message.id));
  const merged = [...current];
  for (const message of page) {
    if (!ids.has(message.id)) merged.push(message);
  }
  merged.sort(byCreatedAt);
  return merged;
}

/**
 * Ids des messages (non supprimés) dont le texte ou la question de sondage
 * contient la recherche, sans casse. Recherche vide → aucun résultat.
 */
export function findThreadSearchMatches(
  messages: ChatMessage[],
  query: string,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return messages
    .filter((message) => {
      if (isChatMessageDeleted(message)) return false;
      const text = message.text ?? message.pollQuestion ?? "";
      return text.toLowerCase().includes(q);
    })
    .map((message) => message.id);
}
