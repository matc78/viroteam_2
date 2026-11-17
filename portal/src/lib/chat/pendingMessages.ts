import type { ChatMessage } from "@/lib/firebase/chatTypes";

/** Statut d’un envoi optimiste. */
export type DeliveryStatus = "sending" | "failed";

/**
 * Message affiché avant confirmation Firestore. `message.id` est l’id du doc
 * Firestore réservé avant l’écriture : il sert à dédoublonner quand le
 * snapshot temps réel contient déjà le message.
 */
export type PendingMessage = {
  message: ChatMessage;
  status: DeliveryStatus;
};

/**
 * Fusionne les messages serveur et les envois en attente : un envoi déjà
 * présent dans le snapshot (écriture locale Firestore) n’est pas doublé mais
 * garde son statut ; les autres sont ajoutés. Résultat trié du plus ancien au
 * plus récent, avec le statut par id.
 */
export function mergePendingMessages(
  serverMessages: ChatMessage[],
  pending: PendingMessage[],
): {
  messages: ChatMessage[];
  deliveryById: Record<string, DeliveryStatus>;
} {
  const deliveryById: Record<string, DeliveryStatus> = {};
  if (pending.length === 0) return { messages: serverMessages, deliveryById };
  const serverIds = new Set(serverMessages.map((message) => message.id));
  const extra: ChatMessage[] = [];
  for (const entry of pending) {
    deliveryById[entry.message.id] = entry.status;
    if (!serverIds.has(entry.message.id)) extra.push(entry.message);
  }
  if (extra.length === 0) return { messages: serverMessages, deliveryById };
  const messages = [...serverMessages, ...extra].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  return { messages, deliveryById };
}
