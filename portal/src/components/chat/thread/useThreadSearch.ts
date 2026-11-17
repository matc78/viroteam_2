"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { findThreadSearchMatches } from "@/lib/chat/threadMessages";
import {
  followSearchPosition,
  searchMatchAtPosition,
  stepSearchPosition,
  type SearchStep,
} from "@/lib/chat/threadSearchNavigation";
import type { ChatMessage } from "@/lib/firebase/chatTypes";

/**
 * Recherche dans le fil : barre ouverte/fermée, requête, résultats,
 * résultat courant (position 1 = plus récent) avec navigation
 * précédent / suivant, et scroll sur le résultat courant.
 */
export function useThreadSearch(params: {
  clubId: string;
  conversationId: string;
  messages: ChatMessage[];
  scrollToMessage: (messageId: string) => void;
}) {
  const { clubId, conversationId, messages, scrollToMessage } = params;
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [position, setPosition] = useState(0);
  const currentIdRef = useRef<string | null>(null);
  const scrollToMessageRef = useRef(scrollToMessage);
  scrollToMessageRef.current = scrollToMessage;

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, [clubId, conversationId]);

  const searchMatches = useMemo(
    () => findThreadSearchMatches(messages, searchQuery),
    [messages, searchQuery],
  );

  // Nouvelle requête → on repart du résultat le plus récent.
  useEffect(() => {
    currentIdRef.current = null;
  }, [searchQuery]);

  // Liste de résultats modifiée → on suit le même message si possible.
  useEffect(() => {
    setPosition(followSearchPosition(searchMatches, currentIdRef.current));
  }, [searchMatches]);

  const currentMatchId = searchOpen
    ? searchMatchAtPosition(searchMatches, position)
    : null;

  // Amène le résultat courant à l’écran quand il change.
  useEffect(() => {
    if (!currentMatchId || currentMatchId === currentIdRef.current) return;
    currentIdRef.current = currentMatchId;
    scrollToMessageRef.current(currentMatchId);
  }, [currentMatchId]);

  /** Passe au résultat suivant (plus ancien) ou précédent (plus récent). */
  function stepMatch(step: SearchStep) {
    if (searchMatches.length === 0) return;
    const next = stepSearchPosition(position, searchMatches.length, step);
    const nextId = searchMatchAtPosition(searchMatches, next);
    setPosition(next);
    // Même résultat (un seul) : on le ramène quand même à l’écran.
    if (nextId && nextId === currentIdRef.current) {
      scrollToMessageRef.current(nextId);
    }
  }

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
    position,
    currentMatchId,
    stepMatch,
    isSearchMatch,
    closeSearch,
  };
}
