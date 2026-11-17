"use client";

import { useEffect, useRef, useState } from "react";
import {
  incomingMessageToAnnounce,
  replyPreviewText,
} from "@/lib/chat/threadMessages";
import type { ChatMessage } from "@/lib/firebase/chatTypes";
import { chatCopy } from "@/lib/copy/chatCopy";

/**
 * Texte de la zone `aria-live` du fil : annonce seulement les messages reçus
 * pendant la lecture (pas le premier chargement, l’historique, mes envois).
 */
export function useNewMessageAnnouncement(params: {
  messages: ChatMessage[];
  /** `false` tant que le premier lot de messages n’est pas arrivé. */
  loaded: boolean;
  viewerUid: string | undefined;
  authorLabel: (senderUid: string | null | undefined) => string;
}): string {
  const { messages, loaded, viewerUid, authorLabel } = params;
  const [announcement, setAnnouncement] = useState("");
  const lastIdRef = useRef<string | null | undefined>(undefined);
  const authorLabelRef = useRef(authorLabel);
  authorLabelRef.current = authorLabel;

  useEffect(() => {
    if (!loaded) return;
    const incoming = incomingMessageToAnnounce({
      previousLastId: lastIdRef.current,
      messages,
      viewerUid,
    });
    lastIdRef.current = messages[messages.length - 1]?.id ?? null;
    if (!incoming) return;
    setAnnouncement(
      chatCopy.newMessageAnnouncement(
        authorLabelRef.current(incoming.senderUid),
        replyPreviewText(incoming),
      ),
    );
  }, [messages, loaded, viewerUid]);

  return announcement;
}
