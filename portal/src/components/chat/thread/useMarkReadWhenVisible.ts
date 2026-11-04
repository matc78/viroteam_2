"use client";

import { useEffect, useRef } from "react";
import { markRead } from "@/lib/firebase/chatService";
import type { ChatMessage } from "@/lib/firebase/chatTypes";
import { useDocumentVisible } from "@/lib/ui/useDocumentVisible";

/**
 * Marque la conversation comme lue quand le fil est réellement vu :
 * vue active (`isActive`, `false` si la page keep-alive est masquée) et onglet
 * visible. Une seule écriture par dernier message.
 */
export function useMarkReadWhenVisible(params: {
  uid: string | undefined;
  clubId: string;
  conversationId: string;
  messages: ChatMessage[];
  isActive: boolean;
}) {
  const { uid, clubId, conversationId, messages, isActive } = params;
  const documentVisible = useDocumentVisible();
  const isSeen = isActive && documentVisible;
  const lastMarkedIdRef = useRef<string | null>(null);

  useEffect(() => {
    lastMarkedIdRef.current = null;
  }, [clubId, conversationId]);

  useEffect(() => {
    if (!uid || !isSeen || messages.length === 0) return;
    const lastId = messages[messages.length - 1]!.id;
    if (lastMarkedIdRef.current === lastId) return;
    lastMarkedIdRef.current = lastId;
    void markRead({ uid, clubId, conversationId });
  }, [messages, uid, clubId, conversationId, isSeen]);
}
