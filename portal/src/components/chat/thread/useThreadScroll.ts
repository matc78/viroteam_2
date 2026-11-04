"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { countMessagesAfter } from "@/lib/chat/threadMessages";
import type { ChatMessage } from "@/lib/firebase/chatTypes";

const NEAR_BOTTOM_PX = 100;
/** Distance au haut du fil qui déclenche le chargement de l’historique. */
const NEAR_TOP_PX = 120;

/**
 * Scroll du fil : suivi « proche du bas », auto-scroll à l’ouverture et aux
 * nouveaux messages (si on lit déjà le bas, ou après un envoi), bouton
 * « nouveaux messages » (compteur depuis qu’on a quitté le bas), chargement
 * de l’historique en remontant (`onNearTop`) avec position de lecture
 * conservée, refs des lignes pour viser un message (citation, recherche,
 * popover d’actions).
 */
export function useThreadScroll(params: {
  clubId: string;
  conversationId: string;
  messages: ChatMessage[];
  /** Appelé quand l’utilisateur remonte près du haut du fil. */
  onNearTop?: () => void;
}) {
  const { clubId, conversationId, messages } = params;
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const skipAutoScrollRef = useRef(false);
  const lastAutoScrolledKeyRef = useRef<string | null>(null);
  const nearBottomRef = useRef(true);
  const forceScrollAfterSendRef = useRef(false);
  const prependAnchorRef = useRef<{ height: number; top: number } | null>(
    null,
  );
  const onNearTopRef = useRef(params.onNearTop);
  onNearTopRef.current = params.onNearTop;
  /** Le bas du fil n’est plus visible (affiche le bouton « derniers messages »). */
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  /** Dernier message vu quand on a quitté le bas (base du compteur). */
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(
    null,
  );

  const lastMessageId =
    messages.length > 0 ? messages[messages.length - 1]!.id : null;
  const lastMessageIdRef = useRef(lastMessageId);
  lastMessageIdRef.current = lastMessageId;
  const autoScrollConversationKey = `${clubId}:${conversationId}`;

  useEffect(() => {
    skipAutoScrollRef.current = false;
    nearBottomRef.current = true;
    forceScrollAfterSendRef.current = false;
    lastAutoScrolledKeyRef.current = null;
    prependAnchorRef.current = null;
    setAwayFromBottom(false);
    setLastSeenMessageId(null);
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

  /** Met à jour l’état « proche du bas » (et la base du compteur). */
  function syncBottomState(near: boolean) {
    nearBottomRef.current = near;
    setAwayFromBottom(!near);
    setLastSeenMessageId((current) => {
      if (near) return null;
      return current ?? lastMessageIdRef.current;
    });
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
    } else {
      bottomRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
    }
    syncBottomState(true);
  }

  useEffect(() => {
    const viewport = messagesRef.current;
    if (!viewport) return;
    const onScroll = () => {
      syncBottomState(isNearBottom());
      const initialScrollDone =
        lastAutoScrolledKeyRef.current === autoScrollConversationKey;
      if (initialScrollDone && viewport.scrollTop <= NEAR_TOP_PX) {
        onNearTopRef.current?.();
      }
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [autoScrollConversationKey]);

  // Historique ajouté en tête : même message en haut de l’écran qu’avant.
  useLayoutEffect(() => {
    const anchor = prependAnchorRef.current;
    const viewport = messagesRef.current;
    if (!anchor || !viewport) return;
    prependAnchorRef.current = null;
    viewport.scrollTop = anchor.top + (viewport.scrollHeight - anchor.height);
  }, [messages]);

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

  /**
   * À appeler juste avant d’insérer l’historique en tête : mémorise la
   * position de lecture et coupe l’auto-scroll de ce rendu.
   */
  function preserveScrollOnPrepend() {
    const viewport = messagesRef.current;
    skipAutoScrollRef.current = true;
    if (!viewport) return;
    prependAnchorRef.current = {
      height: viewport.scrollHeight,
      top: viewport.scrollTop,
    };
  }

  /** Force le scroll en bas au prochain message (envoi en cours). */
  function forceScrollOnNextMessage() {
    forceScrollAfterSendRef.current = true;
  }

  /** Annule le scroll forcé (envoi échoué). */
  function cancelForcedScroll() {
    forceScrollAfterSendRef.current = false;
  }

  /** Bouton « derniers messages » : redescend en bas du fil. */
  function jumpToLatest() {
    scrollMessagesToBottom(true);
  }

  const newMessagesCount = awayFromBottom
    ? countMessagesAfter(messages, lastSeenMessageId)
    : 0;

  return {
    bottomRef,
    messagesRef,
    messageRefs,
    scrollToMessage,
    preserveScrollOnPrepend,
    forceScrollOnNextMessage,
    cancelForcedScroll,
    awayFromBottom,
    newMessagesCount,
    jumpToLatest,
  };
}
