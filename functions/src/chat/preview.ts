import { stringArray } from "../common";
import { truncatePushBody } from "../notifications/copy";

/** Textes serveur de la messagerie (aperçu inbox, citations, push). */
export const ChatCopy = {
  photo: "📷 Photo",
  pollFallback: "Sondage",
  deleted: "Message supprimé",
  newMessage: "Nouveau message",
  defaultTitle: "Message",
} as const;

/** Longueur max de l'aperçu inbox (borne lue par les tuiles app / portail). */
export const CHAT_PREVIEW_MAX = 120;

/** Longueur max d'une question de sondage dans l'aperçu. */
const CHAT_POLL_PREVIEW_MAX = 100;

/** Longueur max d'une citation figée (`replyToText`). */
export const CHAT_REPLY_TEXT_MAX = 140;

/** Rôles qu'on affiche à côté de l'expéditeur (aligné `firestore_fields.dart`). */
const KNOWN_SENDER_ROLES = new Set(["player", "coach", "admin"]);

type MessageData = Record<string, unknown>;

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars
    ? `${text.slice(0, maxChars - 1).trimEnd()}…`
    : text;
}

function trimmedString(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Texte d'aperçu d'un message (inbox, corps de push, citation) : libellé
 * fixe pour une photo, question pour un sondage, texte tronqué sinon.
 * Un message supprimé donne toujours « Message supprimé ».
 */
export function chatMessagePreviewText(
  message: MessageData,
  maxChars = CHAT_PREVIEW_MAX,
): string {
  if (message.deletedAt != null) return ChatCopy.deleted;
  const type = trimmedString(message.type);
  if (type === "image") return ChatCopy.photo;
  if (type === "poll") {
    const question =
      trimmedString(message.pollQuestion) ||
      trimmedString(message.text) ||
      ChatCopy.pollFallback;
    return truncate(`📊 ${truncate(question, CHAT_POLL_PREVIEW_MAX)}`, maxChars);
  }
  return truncate(trimmedString(message.text), maxChars);
}

/**
 * Citation figée à partir du message cité ([source]) : `null` si le message
 * n'existe pas ou a été supprimé (la citation est alors retirée).
 */
export function chatReplySnapshot(
  source: MessageData | undefined,
): { replyToText: string; replyToSenderUid: string } | null {
  if (!source || source.deletedAt != null) return null;
  const replyToText = chatMessagePreviewText(source, CHAT_REPLY_TEXT_MAX);
  const replyToSenderUid = trimmedString(source.senderUid);
  if (!replyToText || !replyToSenderUid) return null;
  return { replyToText, replyToSenderUid };
}

/**
 * Vrai si un message créé à [messageMs] doit remplacer l'aperçu actuel
 * (dernier message à [lastMessageMs]) : protège contre les triggers livrés
 * dans le désordre.
 */
export function shouldAdvanceChatPreview(
  messageMs: number,
  lastMessageMs: number | null,
): boolean {
  return lastMessageMs == null || messageMs >= lastMessageMs;
}

/** Rôle affiché pour l'expéditeur : rôle club connu, sinon parent. */
export function chatSenderRole(memberRole: unknown): string {
  const role = trimmedString(memberRole);
  return KNOWN_SENDER_ROLES.has(role) ? role : "parent";
}

/** Prénom et nom complet d'un profil `users/{uid}`. */
export function chatSenderNames(userData: MessageData | undefined): {
  firstName: string;
  fullName: string;
} {
  const first = trimmedString(userData?.firstName);
  const last = trimmedString(userData?.lastName);
  const display = trimmedString(userData?.displayName);
  const fullName = display || `${first} ${last}`.trim();
  const firstName =
    first || (display ? display.split(/\s+/)[0] ?? "" : "") || fullName;
  return { firstName, fullName };
}

/** Vrai pour un DM 1:1 (un `dm` élargi à plus de 2 est un groupe). */
export function isOneToOneConversation(conversation: MessageData): boolean {
  return (
    trimmedString(conversation.type) === "dm" &&
    stringArray(conversation.participantUids).length <= 2
  );
}

/**
 * Titre + corps du push d'un nouveau message. DM 1:1 : titre = expéditeur,
 * corps = message. Groupe / canal : titre = conversation, corps préfixé du
 * prénom de l'expéditeur.
 */
export function chatPushContent(params: {
  conversation: MessageData;
  senderFirstName: string;
  senderFullName: string;
  preview: string;
}): { title: string; body: string } {
  const isDm = isOneToOneConversation(params.conversation);
  let title = trimmedString(params.conversation.titleOverride);
  if (!title && isDm) title = params.senderFullName;
  if (!title) {
    title = trimmedString(params.conversation.title) || ChatCopy.defaultTitle;
  }
  const messageBody = params.preview || ChatCopy.newMessage;
  const body =
    !isDm && params.senderFirstName
      ? `${params.senderFirstName} : ${messageBody}`
      : messageBody;
  return { title, body: truncatePushBody(body) };
}
