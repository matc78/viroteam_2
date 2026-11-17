"use client";

import { useEffect, useRef, useState } from "react";
import type { PendingMessage } from "@/lib/chat/pendingMessages";
import type { ChatMessage } from "@/lib/firebase/chatTypes";

/** Envoi rejouable : re-déclenche l’écriture avec le même id de message. */
type PendingSend = () => Promise<void>;

/**
 * Envois optimistes du fil : le message apparaît tout de suite (« envoi »),
 * disparaît de la liste locale une fois écrit (le snapshot Firestore prend le
 * relais), passe en « échec » sinon et peut être relancé.
 * Les URL `blob:` des aperçus photo sont libérées au retrait.
 */
export function usePendingMessages(params: {
  clubId: string;
  conversationId: string;
}) {
  const { clubId, conversationId } = params;
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const sendersRef = useRef<Map<string, PendingSend>>(new Map());
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    const senders = sendersRef.current;
    return () => {
      for (const url of objectUrls.values()) URL.revokeObjectURL(url);
      objectUrls.clear();
      senders.clear();
      setPending([]);
    };
  }, [clubId, conversationId]);

  function setStatus(id: string, status: PendingMessage["status"]) {
    setPending((current) =>
      current.map((entry) =>
        entry.message.id === id ? { ...entry, status } : entry,
      ),
    );
  }

  function remove(id: string) {
    sendersRef.current.delete(id);
    const url = objectUrlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(id);
    }
    setPending((current) =>
      current.filter((entry) => entry.message.id !== id),
    );
  }

  /** Lance l’écriture ; « échec » si elle lève (l’erreur est renvoyée). */
  async function run(id: string): Promise<void> {
    const send = sendersRef.current.get(id);
    if (!send) return;
    setStatus(id, "sending");
    try {
      await send();
      remove(id);
    } catch (error) {
      setStatus(id, "failed");
      throw error;
    }
  }

  /**
   * Affiche `message` en « envoi » puis lance `send`.
   * `objectUrl` : aperçu `blob:` à libérer quand l’envoi est terminé.
   */
  function enqueue(options: {
    message: ChatMessage;
    send: PendingSend;
    objectUrl?: string;
  }): Promise<void> {
    const { message, send, objectUrl } = options;
    sendersRef.current.set(message.id, send);
    if (objectUrl) objectUrlsRef.current.set(message.id, objectUrl);
    setPending((current) => [...current, { message, status: "sending" }]);
    return run(message.id);
  }

  /** Relance un envoi en échec. */
  function retry(id: string): Promise<void> {
    return run(id);
  }

  return { pending, enqueue, retry };
}
