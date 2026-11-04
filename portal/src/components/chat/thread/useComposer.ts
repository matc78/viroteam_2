"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { replyPayloadFromTarget } from "@/lib/chat/threadMessages";
import {
  editTextMessage,
  reserveChatMessageId,
  sendImageMessage,
  sendPollMessage,
  sendTextMessage,
} from "@/lib/firebase/chatService";
import { ChatMessageTypes } from "@/lib/firebase/constants";
import {
  isChatMessageDeleted,
  type ChatMessage,
} from "@/lib/firebase/chatTypes";
import { chatCopy } from "@/lib/copy/chatCopy";

/** Sondage saisi dans `CreatePollSheet`. */
type PollDraft = {
  question: string;
  options: string[];
  allowMultiple: boolean;
};

/** File d’envois optimistes (`usePendingMessages`). */
type PendingQueue = {
  enqueue: (options: {
    message: ChatMessage;
    send: () => Promise<void>;
    objectUrl?: string;
  }) => Promise<void>;
};

/** Message local affiché pendant l’envoi (mêmes champs qu’un doc Firestore). */
function localMessage(
  base: Pick<ChatMessage, "id" | "clubId" | "conversationId" | "senderUid">,
  overrides: Partial<ChatMessage>,
): ChatMessage {
  return {
    ...base,
    type: ChatMessageTypes.text,
    text: null,
    storagePath: null,
    downloadUrl: null,
    thumbUrl: null,
    width: null,
    height: null,
    createdAt: new Date(),
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

/** Dimensions d’une image locale (aperçu optimiste), null si illisible. */
async function readImageSize(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

/**
 * Composer du fil : brouillon, citation en cours, modification d’un message
 * (bandeau « Modification »), menu « + », envoi optimiste texte / photo
 * (bouton, collage, glisser-déposer) et sondage.
 * `onSendStart` / `onSendFailed` pilotent le scroll forcé après envoi.
 */
export function useComposer(params: {
  clubId: string;
  conversationId: string;
  uid: string | undefined;
  canWrite: boolean;
  senderFirstName: string;
  senderRole: string;
  pendingQueue: PendingQueue;
  setError: (message: string | null) => void;
  onSendStart: () => void;
  onSendFailed: () => void;
}) {
  const {
    clubId,
    conversationId,
    uid,
    canWrite,
    senderFirstName,
    senderRole,
    pendingQueue,
    setError,
    onSendStart,
    onSendFailed,
  } = params;
  const [draft, setDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null,
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  /** Brouillon mis de côté pendant une modification (restauré à la sortie). */
  const stashedDraftRef = useRef("");

  useEffect(() => {
    setReplyTarget(null);
    setEditingMessage(null);
    setDragOver(false);
    setAttachOpen(false);
  }, [clubId, conversationId]);

  useEffect(() => {
    if (!attachOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!attachWrapRef.current?.contains(event.target as Node)) {
        setAttachOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAttachOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [attachOpen]);

  /** Remet le focus dans le champ (après envoi, citation, modification). */
  function focusInput() {
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  /** Cite un message dans le composer (quitte la modification en cours). */
  function startReply(message: ChatMessage) {
    if (editingMessage) cancelEdit();
    setReplyTarget(message);
    focusInput();
  }

  /** Passe le composer en modification du message texte `message`. */
  function startEdit(message: ChatMessage) {
    if (message.type !== ChatMessageTypes.text || isChatMessageDeleted(message)) {
      return;
    }
    if (!editingMessage) stashedDraftRef.current = draft;
    setReplyTarget(null);
    setEditingMessage(message);
    setDraft(message.text ?? "");
    focusInput();
  }

  /** Quitte la modification et restaure le brouillon mis de côté. */
  function cancelEdit() {
    setEditingMessage(null);
    setDraft(stashedDraftRef.current);
    stashedDraftRef.current = "";
    focusInput();
  }

  async function saveEdit() {
    if (!editingMessage || savingEdit) return;
    const next = draft.trim();
    if (!next) return;
    if (next === (editingMessage.text ?? "").trim()) {
      cancelEdit();
      return;
    }
    setSavingEdit(true);
    setError(null);
    try {
      await editTextMessage({
        clubId,
        conversationId,
        messageId: editingMessage.id,
        text: next,
      });
      cancelEdit();
    } catch {
      setError(chatCopy.editFailed);
      focusInput();
    } finally {
      setSavingEdit(false);
    }
  }

  async function uploadImageFile(file: File) {
    if (!uid || !canWrite) return;
    setError(null);
    const messageId = reserveChatMessageId(clubId, conversationId);
    const reply = replyPayloadFromTarget(replyTarget);
    const size = await readImageSize(file);
    const objectUrl = URL.createObjectURL(file);
    setReplyTarget(null);
    onSendStart();
    try {
      await pendingQueue.enqueue({
        message: localMessage(
          { id: messageId, clubId, conversationId, senderUid: uid },
          {
            type: ChatMessageTypes.image,
            thumbUrl: objectUrl,
            downloadUrl: objectUrl,
            width: size?.width ?? null,
            height: size?.height ?? null,
            ...reply,
          },
        ),
        objectUrl,
        send: async () => {
          const bytes = await file.arrayBuffer();
          await sendImageMessage({
            clubId,
            conversationId,
            senderUid: uid,
            messageId,
            bytes,
            contentType: file.type || "image/jpeg",
            senderFirstName,
            senderRole,
            ...reply,
          });
        },
      });
    } catch (err) {
      console.error("[chat] sendImageMessage failed", err);
      onSendFailed();
      setError(chatCopy.photoFailed);
    }
  }

  /**
   * Valide le composer (submit ou Entrée) : enregistre la modification en
   * cours, sinon envoie le brouillon en optimiste (le champ est vidé tout de
   * suite et garde le focus).
   */
  async function handleSend(event?: FormEvent) {
    event?.preventDefault();
    if (!uid || !canWrite) return;
    if (editingMessage) {
      await saveEdit();
      return;
    }
    const text = draft.trim();
    if (!text) return;
    const messageId = reserveChatMessageId(clubId, conversationId);
    const reply = replyPayloadFromTarget(replyTarget);
    setError(null);
    setDraft("");
    setReplyTarget(null);
    focusInput();
    onSendStart();
    try {
      await pendingQueue.enqueue({
        message: localMessage(
          { id: messageId, clubId, conversationId, senderUid: uid },
          { text, ...reply },
        ),
        send: () =>
          sendTextMessage({
            clubId,
            conversationId,
            senderUid: uid,
            messageId,
            text,
            senderFirstName,
            senderRole,
            ...reply,
          }),
      });
    } catch (err) {
      console.error("[chat] sendTextMessage failed", err);
      onSendFailed();
      setError(chatCopy.sendFailed);
    }
  }

  /** Envoie la photo choisie via l’input fichier. */
  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadImageFile(file);
  }

  /** Colle une image du presse-papiers comme photo. */
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const items = event.clipboardData?.items;
    if (!items || !canWrite || editingMessage) return;
    for (const item of items) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      event.preventDefault();
      void uploadImageFile(file);
      return;
    }
  }

  /** Survol du fil pendant un glisser-déposer. */
  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!canWrite) return;
    event.preventDefault();
    setDragOver(true);
  }

  /** Sortie du fil pendant un glisser-déposer (ignore les enfants). */
  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setDragOver(false);
  }

  /** Dépose une image sur le fil : envoi comme photo. */
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!canWrite) return;
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      void uploadImageFile(file);
    }
  }

  /** Envoie un sondage (l’erreur remonte à `CreatePollSheet`). */
  async function sendPoll(payload: PollDraft) {
    if (!uid) return;
    onSendStart();
    await sendPollMessage({
      clubId,
      conversationId,
      senderUid: uid,
      question: payload.question,
      optionTexts: payload.options,
      allowMultiple: payload.allowMultiple,
      senderFirstName,
      senderRole,
    });
  }

  return {
    draft,
    setDraft,
    inputRef,
    replyTarget,
    setReplyTarget,
    startReply,
    editingMessage,
    savingEdit,
    startEdit,
    cancelEdit,
    dragOver,
    attachOpen,
    setAttachOpen,
    fileInputRef,
    attachWrapRef,
    handleSend,
    handleImage,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    sendPoll,
  };
}
