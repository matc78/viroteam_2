"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { findThreadSearchMatches } from "@/lib/chat/threadMessages";
import type { ChatMessage } from "@/lib/firebase/chatTypes";

/**
 * Recherche dans le fil : barre ouverte/fermée, requête, ids des messages
 * trouvés, et scroll sur le premier résultat.
 */
export function useThreadSearch(params: {
  clubId: string;
  conversationId: string;
  messages: ChatMessage[];
  messageRefs: RefObject<Record<string, HTMLDivElement | null>>;
}) {
  const { clubId, conversationId, messages, messageRefs } = params;
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, [clubId, conversationId]);

  const searchMatches = useMemo(
    () => findThreadSearchMatches(messages, searchQuery),
    [messages, searchQuery],
  );

  useEffect(() => {
    if (!searchOpen || searchMatches.length === 0) return;
    const firstId = searchMatches[0]!;
    messageRefs.current[firstId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [searchOpen, searchQuery, searchMatches, messageRefs]);

  /** True si le message est un résultat de la recherche en cours. */
  function isSearchMatch(messageId: string): boolean {
    return Boolean(
      searchOpen && searchQuery.trim() && searchMatches.includes(messageId),
    );
  }

  /** Ferme la barre et vide la requête. */
  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
  }

  return {
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchMatches,
    isSearchMatch,
    closeSearch,
  };
}
