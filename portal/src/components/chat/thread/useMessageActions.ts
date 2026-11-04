"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  computeAnchoredPopover,
  findScrollParent,
  type AnchoredPopoverLayout,
} from "@/components/chat/anchoredPopover";
import {
  editTextMessage,
  softDeleteMessage,
  toggleReaction,
  votePollOption,
} from "@/lib/firebase/chatService";
import { ChatMessageTypes } from "@/lib/firebase/constants";
import {
  isChatMessageDeleted,
  type ChatMessage,
} from "@/lib/firebase/chatTypes";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import { chatCopy } from "@/lib/copy/chatCopy";

const LONG_PRESS_MS = 450;

/**
 * Actions sur un message : popover ancré sur la bulle (clic droit / appui long),
 * réactions, copie, réponse, édition, suppression, vote de sondage.
 */
export function useMessageActions(params: {
  clubId: string;
  conversationId: string;
  uid: string | undefined;
  messagesRef: RefObject<HTMLDivElement | null>;
  messageRefs: RefObject<Record<string, HTMLDivElement | null>>;
  setError: (message: string | null) => void;
  onReply: (message: ChatMessage) => void;
}) {
  const {
    clubId,
    conversationId,
    uid,
    messagesRef,
    messageRefs,
    setError,
    onReply,
  } = params;
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [actionLayout, setActionLayout] = useState<AnchoredPopoverLayout | null>(
    null,
  );
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null,
  );
  const [editDraft, setEditDraft] = useState("");
  const longPressTimerRef = useRef<number | null>(null);

  const actionOverlayRef = useDialogA11y({
    onClose: () => setActionMessage(null),
    enabled: Boolean(actionMessage && actionLayout),
  });
  const editOverlayRef = useDialogA11y({
    onClose: () => setEditingMessage(null),
    enabled: Boolean(editingMessage),
  });

  useEffect(() => {
    setActionMessage(null);
    setActionLayout(null);
    setEditingMessage(null);
  }, [clubId, conversationId]);

  /** Ferme le popover d’actions. */
  function closeActions() {
    setActionMessage(null);
  }

  /** Ouvre le popover d’actions (sauf message supprimé). */
  function openMessageActions(message: ChatMessage) {
    if (isChatMessageDeleted(message)) return;
    setActionMessage(message);
  }

  const updateActionLayout = useCallback(() => {
    if (!actionMessage) {
      setActionLayout(null);
      return;
    }
    const row = messageRefs.current[actionMessage.id];
    const viewportEl = messagesRef.current;
    // Ancre = la bulle elle-même (pas la row pleine largeur).
    const bubble =
      row?.querySelector<HTMLElement>("[data-msg-bubble]") ?? row;
    if (!bubble || !viewportEl) {
      setActionLayout(null);
      return;
    }
    const mine = uid === actionMessage.senderUid;
    const bubbleRect = bubble.getBoundingClientRect();
    const next = computeAnchoredPopover({
      anchorRect: bubbleRect,
      viewportRect: viewportEl.getBoundingClientRect(),
      // Assez large pour la barre 6 emojis + « + » (évite le clamp qui tronque).
      popupWidth: Math.max(260, Math.min(300, Math.max(bubbleRect.width, 260))),
      estimatedHeight: 300,
      maxHeight: Math.min(360, viewportEl.clientHeight - 16),
      gap: 12,
      alignEnd: mine,
    });
    setActionLayout(next);
  }, [actionMessage, uid, messageRefs, messagesRef]);

  useLayoutEffect(() => {
    updateActionLayout();
  }, [updateActionLayout]);

  useEffect(() => {
    if (!actionMessage) return;
    const viewportEl = messagesRef.current;
    const onScrollOrResize = () => updateActionLayout();
    viewportEl?.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    const scrollParent = findScrollParent(viewportEl);
    if (scrollParent && scrollParent !== viewportEl) {
      scrollParent.addEventListener("scroll", onScrollOrResize, {
        passive: true,
      });
    }
    return () => {
      viewportEl?.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (scrollParent && scrollParent !== viewportEl) {
        scrollParent.removeEventListener("scroll", onScrollOrResize);
      }
    };
  }, [actionMessage, updateActionLayout, messagesRef]);

  /** Annule l’appui long en cours. */
  function clearLongPressTimer() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  /** Démarre l’appui long sur une bulle (hors boutons / liens / champs). */
  function onBubblePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    message: ChatMessage,
  ) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea")) return;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      openMessageActions(message);
    }, LONG_PRESS_MS);
  }

  /** Cite le message dans le composer. */
  function startReply(message: ChatMessage) {
    if (isChatMessageDeleted(message)) return;
    setActionMessage(null);
    onReply(message);
  }

  /** Supprime (soft delete) après confirmation. */
  async function handleDelete(message: ChatMessage) {
    if (!uid) return;
    if (!window.confirm(chatCopy.deleteMessageConfirm)) return;
    setActionMessage(null);
    await softDeleteMessage({
      clubId,
      conversationId,
      messageId: message.id,
      deletedByUid: uid,
    });
  }

  /** Copie le texte du message dans le presse-papiers. */
  async function handleCopy(message: ChatMessage) {
    const text = message.text?.trim() ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError(chatCopy.copyFailed);
    }
    setActionMessage(null);
  }

  /** Ouvre l’édition d’un message texte. */
  function openEdit(message: ChatMessage) {
    if (message.type !== ChatMessageTypes.text) return;
    setActionMessage(null);
    setEditingMessage(message);
    setEditDraft(message.text ?? "");
  }

  /** Ferme l’édition sans enregistrer. */
  function closeEdit() {
    setEditingMessage(null);
  }

  /** Enregistre l’édition (rien à faire si vide ou inchangé). */
  async function handleEditSave() {
    if (!editingMessage) return;
    const next = editDraft.trim();
    if (!next || next === (editingMessage.text ?? "").trim()) {
      setEditingMessage(null);
      return;
    }
    try {
      await editTextMessage({
        clubId,
        conversationId,
        messageId: editingMessage.id,
        text: next,
      });
      setEditingMessage(null);
    } catch {
      setError(chatCopy.editFailed);
    }
  }

  /** Ajoute / retire une réaction. */
  async function handleReaction(message: ChatMessage, emoji: string) {
    if (!uid || isChatMessageDeleted(message)) return;
    setActionMessage(null);
    await toggleReaction({
      clubId,
      conversationId,
      messageId: message.id,
      emoji,
      uid,
    });
  }

  /** Vote pour une option de sondage. */
  async function handleVote(message: ChatMessage, optionId: string) {
    if (!uid || isChatMessageDeleted(message)) return;
    try {
      await votePollOption({
        clubId,
        conversationId,
        messageId: message.id,
        optionId,
        uid,
      });
    } catch {
      setError(chatCopy.pollVoteFailed);
    }
  }

  return {
    actionMessage,
    actionLayout,
    actionOverlayRef,
    closeActions,
    openMessageActions,
    onBubblePointerDown,
    clearLongPressTimer,
    startReply,
    handleDelete,
    handleCopy,
    handleReaction,
    handleVote,
    editingMessage,
    editDraft,
    setEditDraft,
    editOverlayRef,
    openEdit,
    closeEdit,
    handleEditSave,
  };
}
