"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildThreadRows,
  resolveUnreadSeparatorAnchor,
  type UnreadSeparatorAnchor,
} from "@/lib/chat/buildThreadRows";
import {
  mergePendingMessages,
  type PendingMessage,
} from "@/lib/chat/pendingMessages";
import {
  appendOlderPage,
  mergeThreadMessages,
} from "@/lib/chat/threadMessages";
import {
  fetchOlderMessages,
  watchConversation,
  watchMessages,
} from "@/lib/firebase/chatService";
import type {
  ChatConversation,
  ChatMessage,
  ChatUserState,
} from "@/lib/firebase/chatTypes";
import { chatCopy } from "@/lib/copy/chatCopy";

const REALTIME_MESSAGE_LIMIT = 100;
const OLDER_PAGE_SIZE = 50;

/** État de chargement du fil : 1er snapshot attendu, reçu, ou en erreur. */
export type ThreadLoadStatus = "loading" | "ready" | "error";

/**
 * Fil d’une conversation : doc conversation + messages temps réel,
 * envois optimistes (`pending`), pagination de l’historique, lignes à
 * afficher (jours + « nouveau » + regroupement), état de chargement / erreur
 * avec relance. `inboxConversation` sert de repli tant que le doc live n’est
 * pas arrivé.
 */
export function useThreadMessages(params: {
  clubId: string;
  conversationId: string;
  inboxConversation: ChatConversation | null;
  chatState?: ChatUserState;
  viewerUid?: string;
  pending: PendingMessage[];
}) {
  const {
    clubId,
    conversationId,
    inboxConversation,
    chatState,
    viewerUid,
    pending,
  } = params;
  const [conversationLive, setConversationLive] =
    useState<ChatConversation | null>(null);
  const conversation = conversationLive ?? inboxConversation;
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [status, setStatus] = useState<ThreadLoadStatus>("loading");
  /** Incrémenté par « Réessayer » pour relancer les abonnements. */
  const [reloadKey, setReloadKey] = useState(0);
  /** Ancre séparateur « nouveau » figée à l’open (avant markRead). */
  const unreadSeparatorAnchorRef = useRef<UnreadSeparatorAnchor>(null);
  const unreadSnapshotKeyRef = useRef<string | null>(null);

  const threadKey = `${clubId}:${conversationId}`;
  if (unreadSnapshotKeyRef.current !== threadKey) {
    unreadSnapshotKeyRef.current = threadKey;
    unreadSeparatorAnchorRef.current = resolveUnreadSeparatorAnchor({
      conversation,
      chatState,
      viewerUid,
    });
  }

  useEffect(() => {
    setOlderMessages([]);
    setRealtimeMessages([]);
    setHasMoreOlder(false);
    setLoadingOlder(false);
  }, [clubId, conversationId]);

  useEffect(() => {
    setConversationLive(null);
    setStatus("loading");
    const unsubConv = watchConversation({
      clubId,
      conversationId,
      onData: setConversationLive,
    });
    const unsubMsgs = watchMessages({
      clubId,
      conversationId,
      messageLimit: REALTIME_MESSAGE_LIMIT,
      onData: (list) => {
        setRealtimeMessages(list);
        setStatus("ready");
        setHasMoreOlder((previous) =>
          previous ? previous : list.length >= REALTIME_MESSAGE_LIMIT,
        );
      },
      onError: (error) => {
        console.error("[chat] watchMessages failed", error);
        setStatus("error");
      },
    });
    return () => {
      unsubConv();
      unsubMsgs();
    };
  }, [clubId, conversationId, reloadKey]);

  /** Relance l’écoute du fil après une erreur. */
  function retry() {
    setReloadKey((key) => key + 1);
  }

  const serverMessages = useMemo(
    () => mergeThreadMessages(olderMessages, realtimeMessages),
    [olderMessages, realtimeMessages],
  );

  const { messages, deliveryById } = useMemo(
    () => mergePendingMessages(serverMessages, pending),
    [serverMessages, pending],
  );

  const threadRows = useMemo(
    () =>
      buildThreadRows({
        messages,
        anchor: unreadSeparatorAnchorRef.current,
        viewerUid,
      }),
    [messages, viewerUid],
  );

  /**
   * Charge la page d’historique précédente. `beforePrepend` est appelé juste
   * avant l’insertion (mémoriser la position de lecture, couper l’auto-scroll).
   */
  async function loadOlder(options: {
    beforePrepend: () => void;
    setError: (message: string | null) => void;
  }) {
    if (loadingOlder || !hasMoreOlder || serverMessages.length === 0) return;
    const { beforePrepend, setError } = options;
    const oldest = serverMessages[0]!;
    setLoadingOlder(true);
    try {
      const page = await fetchOlderMessages({
        clubId,
        conversationId,
        beforeCreatedAt: oldest.createdAt,
        beforeDocId: oldest.id,
        limit: OLDER_PAGE_SIZE,
      });
      if (page.length === 0) {
        setHasMoreOlder(false);
      } else {
        beforePrepend();
        setOlderMessages((current) => appendOlderPage(current, page));
        setHasMoreOlder(page.length >= OLDER_PAGE_SIZE);
      }
    } catch {
      setError(chatCopy.loadOlderFailed);
    } finally {
      setLoadingOlder(false);
    }
  }

  return {
    conversation,
    messages,
    deliveryById,
    threadRows,
    status,
    retry,
    hasMoreOlder,
    loadingOlder,
    loadOlder,
  };
}
