"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/firebase/chatTypes";

const NEAR_BOTTOM_PX = 100;

/**
 * Scroll du fil : suivi « proche du bas », auto-scroll à l’ouverture et aux
 * nouveaux messages (si on lit déjà le bas, ou après un envoi), refs des
 * lignes pour viser un message (citation, recherche, popover d’actions).
 */
export function useThreadScroll(params: {
  clubId: string;
  conversationId: string;
  messages: ChatMessage[];
}) {
  const { clubId, conversationId, messages } = params;
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const skipAutoScrollRef = useRef(false);
  const lastAutoScrolledKeyRef = useRef<string | null>(null);
  const nearBottomRef = useRef(true);
  const forceScrollAfterSendRef = useRef(false);

  const lastMessageId =
    messages.length > 0 ? messages[messages.length - 1]!.id : null;
  const autoScrollConversationKey = `${clubId}:${conversationId}`;

  useEffect(() => {
    skipAutoScrollRef.current = false;
    nearBottomRef.current = true;
    forceScrollAfterSendRef.current = false;
    lastAutoScrolledKeyRef.current = null;
  }, [clubId, conversationId]);

  /** True si le viewport est proche du bas du fil. */
  function isNearBottom(): boolean {
    const viewport = messagesRef.current;
    if (!viewport) return true;
    return (
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
      NEAR_BOTTOM_PX
    );
  }

  /** Scroll le fil jusqu’aux derniers messages. */
  function scrollMessagesToBottom(smooth: boolean) {
    const viewport = messagesRef.current;
    if (viewport) {
      if (smooth) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      } else {
        viewport.scrollTop = viewport.scrollHeight;
      }
      nearBottomRef.current = true;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    nearBottomRef.current = true;
  }

  useEffect(() => {
    const viewport = messagesRef.current;
    if (!viewport) return;
    const onScroll = () => {
      nearBottomRef.current = isNearBottom();
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [clubId, conversationId]);

  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    if (messages.length === 0) return;
    const isOpeningThread =
      lastAutoScrolledKeyRef.current !== autoScrollConversationKey;
    const forceAfterSend = forceScrollAfterSendRef.current;
    if (forceAfterSend) forceScrollAfterSendRef.current = false;
    if (!isOpeningThread && !nearBottomRef.current && !forceAfterSend) {
      return;
    }
    lastAutoScrolledKeyRef.current = autoScrollConversationKey;
    const smooth = !isOpeningThread;
    // Double passe : layout flex / images peuvent encore grandir après le paint.
    const run = () => scrollMessagesToBottom(smooth);
    run();
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  }, [autoScrollConversationKey, messages.length, lastMessageId]);

  /** Scroll centré sur un message du fil (citation, recherche). */
  function scrollToMessage(messageId: string) {
    messageRefs.current[messageId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  /** Prochain changement de messages sans auto-scroll (historique ajouté en tête). */
  function skipNextAutoScroll() {
    skipAutoScrollRef.current = true;
  }

  /** Force le scroll en bas au prochain message (envoi en cours). */
  function forceScrollOnNextMessage() {
    forceScrollAfterSendRef.current = true;
  }

  /** Annule le scroll forcé (envoi échoué). */
  function cancelForcedScroll() {
    forceScrollAfterSendRef.current = false;
  }

  return {
    bottomRef,
    messagesRef,
    messageRefs,
    scrollToMessage,
    skipNextAutoScroll,
    forceScrollOnNextMessage,
    cancelForcedScroll,
  };
}
