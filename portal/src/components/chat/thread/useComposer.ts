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
  sendImageMessage,
  sendPollMessage,
  sendTextMessage,
} from "@/lib/firebase/chatService";
import type { ChatMessage } from "@/lib/firebase/chatTypes";
import { chatCopy } from "@/lib/copy/chatCopy";

/** Sondage saisi dans `CreatePollSheet`. */
type PollDraft = {
  question: string;
  options: string[];
  allowMultiple: boolean;
};

/**
 * Composer du fil : brouillon, citation en cours, menu « + », envoi
 * texte / photo (bouton, collage, glisser-déposer) / sondage.
 * `onSendStart` / `onSendFailed` pilotent le scroll forcé après envoi.
 */
export function useComposer(params: {
  clubId: string;
  conversationId: string;
  uid: string | undefined;
  canWrite: boolean;
  senderFirstName: string;
  senderRole: string;
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
    setError,
    onSendStart,
    onSendFailed,
  } = params;
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setReplyTarget(null);
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

  async function uploadImageFile(file: File) {
    if (!uid || !canWrite || busy) return;
    setBusy(true);
    setError(null);
    onSendStart();
    try {
      const bytes = await file.arrayBuffer();
      await sendImageMessage({
        clubId,
        conversationId,
        senderUid: uid,
        bytes,
        contentType: file.type || "image/jpeg",
        senderFirstName,
        senderRole,
        ...replyPayloadFromTarget(replyTarget),
      });
      setReplyTarget(null);
    } catch {
      onSendFailed();
      setError(chatCopy.photoFailed);
    } finally {
      setBusy(false);
    }
  }

  /** Envoie le brouillon texte (submit du formulaire ou Entrée). */
  async function handleSend(event?: FormEvent) {
    event?.preventDefault();
    if (!uid || !canWrite || busy) return;
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    onSendStart();
    try {
      await sendTextMessage({
        clubId,
        conversationId,
        senderUid: uid,
        text,
        senderFirstName,
        senderRole,
        ...replyPayloadFromTarget(replyTarget),
      });
      setDraft("");
      setReplyTarget(null);
    } catch (err) {
      onSendFailed();
      console.error("[chat] sendTextMessage failed", err);
      const detail =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : chatCopy.unknownError;
      setError(chatCopy.sendFailedWithDetail(detail));
    } finally {
      setBusy(false);
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
    if (!items || !canWrite) return;
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
    busy,
    replyTarget,
    setReplyTarget,
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
