import {
  collection,
  doc,
  type DocumentData,
  type Firestore,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import {
  createCategoryChannel as createCategoryChannelCallable,
  createCoachDm as createCoachDmCallable,
  ensureClubChatSynced as ensureClubChatSyncedCallable,
} from "./callableService";
import {
  ChatMessageTypes,
  ChatWritePolicies,
  Collections,
  Fields,
  MemberRoles,
} from "./constants";
import { uploadImageAtPath } from "./storage";
import {
  type ChatConversation,
  type ChatMessage,
  type ChatPollOption,
  type ChatUserState,
  chatStateDocId,
} from "./chatTypes";
import { toDate } from "./types";

function db(): Firestore {
  return getAppFirestore();
}

function conversationsCol(clubId: string) {
  return collection(
    db(),
    Collections.clubs,
    clubId,
    Collections.conversations,
  );
}

function messagesCol(clubId: string, conversationId: string) {
  return collection(
    conversationsCol(clubId),
    conversationId,
    Collections.chatMessages,
  );
}

function chatStateCol(uid: string) {
  return collection(db(), Collections.users, uid, Collections.chatState);
}

function stringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string" && item.length > 0);
}

function parseUidListsMap(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || !Array.isArray(value)) continue;
    out[key] = value.filter(
      (item): item is string => typeof item === "string",
    );
  }
  return out;
}

function parsePollOptions(raw: unknown): ChatPollOption[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatPollOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const map = item as Record<string, unknown>;
    const id = String(map.id ?? "").trim();
    const text = String(map.text ?? "").trim();
    if (!id || !text) continue;
    out.push({ id, text });
  }
  return out;
}

function previewText(text: string): string {
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/** Parse un document conversation. */
export function parseChatConversation(
  clubId: string,
  id: string,
  data: DocumentData,
): ChatConversation {
  return {
    id,
    clubId,
    type: String(data[Fields.type] ?? "team"),
    title: String(data[Fields.title] ?? ""),
    titleOverride:
      typeof data[Fields.titleOverride] === "string"
        ? data[Fields.titleOverride]
        : null,
    systemKey:
      typeof data[Fields.systemKey] === "string" ? data[Fields.systemKey] : null,
    teamId: typeof data[Fields.teamId] === "string" ? data[Fields.teamId] : null,
    categoryKey:
      typeof data[Fields.categoryKey] === "string"
        ? data[Fields.categoryKey]
        : null,
    participantUids: stringList(data[Fields.participantUids]),
    writePolicy: String(data[Fields.writePolicy] ?? ChatWritePolicies.open),
    lastMessageAt: toDate(data[Fields.lastMessageAt]),
    lastMessagePreview: String(data[Fields.lastMessagePreview] ?? ""),
    lastSenderUid:
      typeof data[Fields.lastSenderUid] === "string"
        ? data[Fields.lastSenderUid]
        : null,
    createdAt: toDate(data[Fields.createdAt]),
    updatedAt: toDate(data[Fields.updatedAt]),
  };
}

/** Parse un document message. */
export function parseChatMessage(
  clubId: string,
  conversationId: string,
  id: string,
  data: DocumentData,
): ChatMessage {
  const textRaw = data[Fields.text] ?? data[Fields.message];
  return {
    id,
    clubId,
    conversationId,
    type: String(data[Fields.type] ?? ChatMessageTypes.text),
    text: typeof textRaw === "string" ? textRaw : null,
    storagePath:
      typeof data[Fields.storagePath] === "string"
        ? data[Fields.storagePath]
        : null,
    downloadUrl:
      typeof data[Fields.downloadUrl] === "string"
        ? data[Fields.downloadUrl]
        : null,
    thumbUrl:
      typeof data[Fields.thumbUrl] === "string" ? data[Fields.thumbUrl] : null,
    width: typeof data[Fields.width] === "number" ? data[Fields.width] : null,
    height:
      typeof data[Fields.height] === "number" ? data[Fields.height] : null,
    senderUid: String(data[Fields.senderUid] ?? ""),
    createdAt: toDate(data[Fields.createdAt]) ?? new Date(),
    deletedAt: toDate(data[Fields.deletedAt]),
    deletedByUid:
      typeof data[Fields.deletedByUid] === "string"
        ? data[Fields.deletedByUid]
        : null,
    reactions: parseUidListsMap(data[Fields.reactions]),
    pollQuestion:
      typeof data[Fields.pollQuestion] === "string"
        ? data[Fields.pollQuestion]
        : null,
    pollOptions: parsePollOptions(data[Fields.pollOptions]),
    pollVotes: parseUidListsMap(data[Fields.pollVotes]),
    pollAllowMultiple: Boolean(data[Fields.pollAllowMultiple]),
  };
}

/** Parse un document chatState. */
export function parseChatUserState(
  id: string,
  data: DocumentData,
): ChatUserState {
  return {
    id,
    muted: Boolean(data[Fields.muted]),
    lastReadAt: toDate(data[Fields.lastReadAt]),
    unreadCount: Number(data[Fields.unreadCount] ?? 0) || 0,
  };
}

function sortConversations(list: ChatConversation[]): ChatConversation[] {
  const sorted = [...list];
  sorted.sort((a, b) => {
    const aAt = a.lastMessageAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
    const bAt = b.lastMessageAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
    return bAt - aAt;
  });
  return sorted;
}

/**
 * Écoute les conversations d’un club où uid est participant.
 * @returns Unsubscribe Firestore.
 */
export function watchClubConversations(params: {
  clubId: string;
  uid: string;
  onData: (conversations: ChatConversation[]) => void;
  onError?: (error: Error) => void;
}): Unsubscribe {
  const q = query(
    conversationsCol(params.clubId),
    where(Fields.participantUids, "array-contains", params.uid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((docSnap) =>
        parseChatConversation(
          params.clubId,
          docSnap.id,
          docSnap.data(),
        ),
      );
      params.onData(sortConversations(list));
    },
    (error) => params.onError?.(error),
  );
}

/**
 * Fusion multi-clubs des conversations (N listeners + merge client).
 * @returns Unsubscribe global.
 */
export function watchInbox(params: {
  uid: string;
  clubIds: string[];
  onData: (conversations: ChatConversation[]) => void;
  onError?: (error: Error) => void;
}): Unsubscribe {
  if (params.clubIds.length === 0) {
    params.onData([]);
    return () => undefined;
  }

  const byClub = new Map<string, ChatConversation[]>();
  const unsubs: Unsubscribe[] = [];

  const emit = () => {
    params.onData(sortConversations([...byClub.values()].flat()));
  };

  for (const clubId of params.clubIds) {
    unsubs.push(
      watchClubConversations({
        clubId,
        uid: params.uid,
        onData: (list) => {
          byClub.set(clubId, list);
          emit();
        },
        onError: params.onError,
      }),
    );
  }

  return () => {
    for (const unsub of unsubs) unsub();
  };
}

/** Écoute une conversation. */
export function watchConversation(params: {
  clubId: string;
  conversationId: string;
  onData: (conversation: ChatConversation | null) => void;
  onError?: (error: Error) => void;
}): Unsubscribe {
  const ref = doc(conversationsCol(params.clubId), params.conversationId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        params.onData(null);
        return;
      }
      params.onData(
        parseChatConversation(params.clubId, snap.id, snap.data()),
      );
    },
    (error) => params.onError?.(error),
  );
}

/** Messages récents (ordre chrono croissant pour l’UI). */
export function watchMessages(params: {
  clubId: string;
  conversationId: string;
  messageLimit?: number;
  onData: (messages: ChatMessage[]) => void;
  onError?: (error: Error) => void;
}): Unsubscribe {
  const q = query(
    messagesCol(params.clubId, params.conversationId),
    orderBy(Fields.createdAt, "desc"),
    limit(params.messageLimit ?? 50),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((docSnap) =>
        parseChatMessage(
          params.clubId,
          params.conversationId,
          docSnap.id,
          docSnap.data(),
        ),
      );
      params.onData(list.reverse());
    },
    (error) => params.onError?.(error),
  );
}

/** États mute / unread de l’utilisateur. */
export function watchChatStates(params: {
  uid: string;
  onData: (states: Record<string, ChatUserState>) => void;
  onError?: (error: Error) => void;
}): Unsubscribe {
  return onSnapshot(
    chatStateCol(params.uid),
    (snap) => {
      const map: Record<string, ChatUserState> = {};
      for (const docSnap of snap.docs) {
        map[docSnap.id] = parseChatUserState(docSnap.id, docSnap.data());
      }
      params.onData(map);
    },
    (error) => params.onError?.(error),
  );
}

/** Somme des non-lus hors conversations mutées. */
export function totalUnreadCount(
  states: Record<string, ChatUserState>,
): number {
  let total = 0;
  for (const state of Object.values(states)) {
    if (state.muted) continue;
    total += Math.max(0, state.unreadCount);
  }
  return total;
}

/**
 * True si l’utilisateur peut écrire selon writePolicy + rôle club.
 * Parents participants : rôle null → autorisé seulement si policy `open`.
 */
export function canWriteToConversation(params: {
  conversation: ChatConversation;
  uid: string;
  clubRole: string | null;
}): boolean {
  const { conversation, uid, clubRole } = params;
  if (!conversation.participantUids.includes(uid)) return false;
  switch (conversation.writePolicy) {
    case ChatWritePolicies.adminsOnly:
      return clubRole === MemberRoles.admin;
    case ChatWritePolicies.coachesAndAdmins:
      return (
        clubRole === MemberRoles.admin || clubRole === MemberRoles.coach
      );
    default:
      return true;
  }
}

/** Envoie un message texte et met à jour le preview. */
export async function sendTextMessage(params: {
  clubId: string;
  conversationId: string;
  senderUid: string;
  text: string;
}): Promise<void> {
  const trimmed = params.text.trim();
  if (!trimmed) return;
  const messageRef = doc(messagesCol(params.clubId, params.conversationId));
  const batch = writeBatch(db());
  batch.set(messageRef, {
    [Fields.type]: ChatMessageTypes.text,
    [Fields.text]: trimmed,
    [Fields.senderUid]: params.senderUid,
    [Fields.createdAt]: serverTimestamp(),
    [Fields.reactions]: {},
  });
  batch.update(doc(conversationsCol(params.clubId), params.conversationId), {
    [Fields.lastMessageAt]: serverTimestamp(),
    [Fields.lastMessagePreview]: previewText(trimmed),
    [Fields.lastSenderUid]: params.senderUid,
    [Fields.updatedAt]: serverTimestamp(),
  });
  await batch.commit();
}

/** Upload photo puis crée le message image. */
export async function sendImageMessage(params: {
  clubId: string;
  conversationId: string;
  senderUid: string;
  bytes: ArrayBuffer;
  contentType?: string;
}): Promise<void> {
  const messageRef = doc(messagesCol(params.clubId, params.conversationId));
  const contentType = params.contentType ?? "image/jpeg";
  const path = `clubs/${params.clubId}/chat/${params.conversationId}/${params.senderUid}/${messageRef.id}.jpg`;
  const url = await uploadImageAtPath({
    path,
    bytes: params.bytes,
    contentType,
  });
  const batch = writeBatch(db());
  batch.set(messageRef, {
    [Fields.type]: ChatMessageTypes.image,
    [Fields.storagePath]: path,
    [Fields.downloadUrl]: url,
    [Fields.thumbUrl]: url,
    [Fields.senderUid]: params.senderUid,
    [Fields.createdAt]: serverTimestamp(),
    [Fields.reactions]: {},
  });
  batch.update(doc(conversationsCol(params.clubId), params.conversationId), {
    [Fields.lastMessageAt]: serverTimestamp(),
    [Fields.lastMessagePreview]: "📷 Photo",
    [Fields.lastSenderUid]: params.senderUid,
    [Fields.updatedAt]: serverTimestamp(),
  });
  await batch.commit();
}

/** Soft-delete d’un message. */
export async function softDeleteMessage(params: {
  clubId: string;
  conversationId: string;
  messageId: string;
  deletedByUid: string;
}): Promise<void> {
  await updateDoc(
    doc(messagesCol(params.clubId, params.conversationId), params.messageId),
    {
      [Fields.deletedAt]: serverTimestamp(),
      [Fields.deletedByUid]: params.deletedByUid,
    },
  );
}

/** Crée un sondage (groupes > 2 participants). */
export async function sendPollMessage(params: {
  clubId: string;
  conversationId: string;
  senderUid: string;
  question: string;
  optionTexts: string[];
  allowMultiple?: boolean;
}): Promise<void> {
  const trimmedQuestion = params.question.trim();
  const options = params.optionTexts
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
  if (!trimmedQuestion || options.length < 2) {
    throw new Error("Sondage : question + au moins 2 options.");
  }
  if (options.length > 12) {
    throw new Error("Sondage : 12 options max.");
  }

  const convDoc = await getDoc(
    doc(conversationsCol(params.clubId), params.conversationId),
  );
  const participants = stringList(convDoc.data()?.[Fields.participantUids]);
  if (participants.length <= 2) {
    throw new Error("Les sondages sont réservés aux groupes.");
  }

  const pollOptions: ChatPollOption[] = [];
  const pollVotes: Record<string, string[]> = {};
  options.forEach((text, index) => {
    const id = `o${index}`;
    pollOptions.push({ id, text });
    pollVotes[id] = [];
  });

  const messageRef = doc(messagesCol(params.clubId, params.conversationId));
  const preview = previewText(`📊 ${trimmedQuestion}`);
  const batch = writeBatch(db());
  batch.set(messageRef, {
    [Fields.type]: ChatMessageTypes.poll,
    [Fields.text]: trimmedQuestion,
    [Fields.pollQuestion]: trimmedQuestion,
    [Fields.pollOptions]: pollOptions,
    [Fields.pollVotes]: pollVotes,
    [Fields.pollAllowMultiple]: params.allowMultiple ?? false,
    [Fields.senderUid]: params.senderUid,
    [Fields.createdAt]: serverTimestamp(),
    [Fields.reactions]: {},
  });
  batch.update(doc(conversationsCol(params.clubId), params.conversationId), {
    [Fields.lastMessageAt]: serverTimestamp(),
    [Fields.lastMessagePreview]: preview,
    [Fields.lastSenderUid]: params.senderUid,
    [Fields.updatedAt]: serverTimestamp(),
  });
  await batch.commit();
}

/** Vote (ou retire le vote) sur une option de sondage. */
export async function votePollOption(params: {
  clubId: string;
  conversationId: string;
  messageId: string;
  optionId: string;
  uid: string;
}): Promise<void> {
  const ref = doc(
    messagesCol(params.clubId, params.conversationId),
    params.messageId,
  );
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    if (data[Fields.type] !== ChatMessageTypes.poll) {
      throw new Error("Pas un sondage");
    }
    if (data[Fields.deletedAt] != null) {
      throw new Error("Sondage supprimé");
    }

    const allowMultiple = Boolean(data[Fields.pollAllowMultiple]);
    const votes = parseUidListsMap(data[Fields.pollVotes]);
    const currentlySelected =
      votes[params.optionId]?.includes(params.uid) ?? false;

    if (allowMultiple) {
      const list = [...(votes[params.optionId] ?? [])];
      if (currentlySelected) {
        const next = list.filter((id) => id !== params.uid);
        if (next.length === 0) delete votes[params.optionId];
        else votes[params.optionId] = next;
      } else {
        votes[params.optionId] = [...list, params.uid];
      }
    } else {
      for (const key of Object.keys(votes)) {
        const list = (votes[key] ?? []).filter((id) => id !== params.uid);
        if (list.length === 0) delete votes[key];
        else votes[key] = list;
      }
      if (!currentlySelected) {
        votes[params.optionId] = [
          ...(votes[params.optionId] ?? []),
          params.uid,
        ];
      }
    }

    tx.update(ref, { [Fields.pollVotes]: votes });
  });
}

/** Toggle réaction emoji. */
export async function toggleReaction(params: {
  clubId: string;
  conversationId: string;
  messageId: string;
  emoji: string;
  uid: string;
}): Promise<void> {
  const ref = doc(
    messagesCol(params.clubId, params.conversationId),
    params.messageId,
  );
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const reactions = parseUidListsMap(data[Fields.reactions]);
    const current = [...(reactions[params.emoji] ?? [])];
    if (current.includes(params.uid)) {
      const next = current.filter((id) => id !== params.uid);
      if (next.length === 0) delete reactions[params.emoji];
      else reactions[params.emoji] = next;
    } else {
      reactions[params.emoji] = [...current, params.uid];
    }
    tx.update(ref, { [Fields.reactions]: reactions });
  });
}

/** Mute / unmute. */
export async function setMuted(params: {
  uid: string;
  clubId: string;
  conversationId: string;
  muted: boolean;
}): Promise<void> {
  const id = chatStateDocId(params.clubId, params.conversationId);
  await setDoc(
    doc(chatStateCol(params.uid), id),
    {
      [Fields.muted]: params.muted,
      [Fields.updatedAt]: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Marque la conversation comme lue. */
export async function markRead(params: {
  uid: string;
  clubId: string;
  conversationId: string;
}): Promise<void> {
  const id = chatStateDocId(params.clubId, params.conversationId);
  await setDoc(
    doc(chatStateCol(params.uid), id),
    {
      [Fields.unreadCount]: 0,
      [Fields.lastReadAt]: serverTimestamp(),
      [Fields.updatedAt]: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Renomme la conversation (titleOverride). */
export async function renameConversation(params: {
  clubId: string;
  conversationId: string;
  titleOverride: string;
}): Promise<void> {
  await updateDoc(doc(conversationsCol(params.clubId), params.conversationId), {
    [Fields.titleOverride]: params.titleOverride.trim(),
    [Fields.updatedAt]: serverTimestamp(),
  });
}

/** Callable : DM avec coaches / admins. */
export async function createCoachDm(params: {
  clubId: string;
  targetUids: string[];
  teamId?: string;
}): Promise<string> {
  const result = await createCoachDmCallable(params);
  return result.conversationId;
}

/** Callable admin : canal catégorie. */
export async function createCategoryChannel(params: {
  clubId: string;
  categoryKey: string;
  title: string;
  writePolicy?: string;
}): Promise<string> {
  const result = await createCategoryChannelCallable(params);
  return result.conversationId;
}

/** Retrouve une conv système par clé. */
export async function findConversationIdBySystemKey(params: {
  clubId: string;
  systemKey: string;
}): Promise<string | null> {
  const snap = await getDocs(
    query(
      conversationsCol(params.clubId),
      where(Fields.systemKey, "==", params.systemKey),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  return snap.docs[0]!.id;
}

/** Backfill chats système d’un club. */
export async function ensureClubChatSynced(clubId: string): Promise<void> {
  await ensureClubChatSyncedCallable({ clubId });
}

/** Ensure puis retrouve une conv système. */
export async function ensureAndFindConversationId(params: {
  clubId: string;
  systemKey: string;
}): Promise<string | null> {
  let id = await findConversationIdBySystemKey(params);
  if (id) return id;
  await ensureClubChatSynced(params.clubId);
  return findConversationIdBySystemKey(params);
}

/** Best-effort sync de tous les clubs (ouverture inbox). */
export async function ensureClubsChatSynced(clubIds: string[]): Promise<void> {
  await Promise.allSettled(clubIds.map((clubId) => ensureClubChatSynced(clubId)));
}

/** Chemin page messages selon l’espace. */
export function messagesPagePath(
  space: "bureau" | "family",
  thread?: { clubId: string; conversationId: string },
): string {
  const base = space === "family" ? "/family/messages" : "/messages";
  if (!thread) return base;
  const search = new URLSearchParams({
    clubId: thread.clubId,
    conversationId: thread.conversationId,
  });
  return `${base}?${search.toString()}`;
}
