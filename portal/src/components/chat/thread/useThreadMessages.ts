"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildThreadRows,
  resolveUnreadSeparatorAnchor,
  type UnreadSeparatorAnchor,
} from "@/lib/chat/buildThreadRows";
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

const REALTIME_MESSAGE_LIMIT = 100;
const OLDER_PAGE_SIZE = 50;

/**
 * Fil d’une conversation : doc conversation + messages temps réel,
 * pagination de l’historique, lignes à afficher (jours + « nouveau »).
 * `inboxConversation` sert de repli tant que le doc live n’est pas arrivé.
 */
export function useThreadMessages(params: {
  clubId: string;
  conversationId: string;
  inboxConversation: ChatConversation | null;
  chatState?: ChatUserState;
  viewerUid?: string;
}) {
  const { clubId, conversationId, inboxConversation, chatState, viewerUid } =
    params;
  const [conversationLive, setConversationLive] =
    useState<ChatConversation | null>(null);
  const conversation = conversationLive ?? inboxConversation;
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
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
        setHasMoreOlder((previous) =>
          previous ? previous : list.length >= REALTIME_MESSAGE_LIMIT,
        );
      },
    });
    return () => {
      unsubConv();
      unsubMsgs();
    };
  }, [clubId, conversationId]);

  const messages = useMemo(
    () => mergeThreadMessages(olderMessages, realtimeMessages),
    [olderMessages, realtimeMessages],
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
   * Charge la page d’historique précédente et garde la position de lecture.
   * `beforePrepend` est appelé juste avant l’insertion (ex. couper l’auto-scroll).
   */
  async function loadOlder(options: {
    viewport: HTMLDivElement | null;
    beforePrepend: () => void;
    setError: (message: string | null) => void;
  }) {
    if (loadingOlder || !hasMoreOlder || messages.length === 0) return;
    const { viewport, beforePrepend, setError } = options;
    const oldest = messages[0]!;
    const previousHeight = viewport?.scrollHeight ?? 0;
    setLoadingOlder(true);
    setError(null);
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
        requestAnimationFrame(() => {
          if (!viewport) return;
          viewport.scrollTop += viewport.scrollHeight - previousHeight;
        });
      }
    } catch {
      setError("Impossible de charger l’historique.");
    } finally {
      setLoadingOlder(false);
    }
  }

  return {
    conversation,
    messages,
    threadRows,
    hasMoreOlder,
    loadingOlder,
    loadOlder,
  };
}
