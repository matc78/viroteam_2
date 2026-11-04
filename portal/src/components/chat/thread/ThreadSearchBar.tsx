"use client";

import { ChatIcon } from "@/components/chat/ChatIcons";
import type { SearchStep } from "@/lib/chat/threadSearchNavigation";
import styles from "../ChatThreadView.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type ThreadSearchBarProps = {
  query: string;
  matchCount: number;
  /** Position du résultat courant (1 = plus récent), 0 si aucun. */
  position: number;
  onQueryChange: (query: string) => void;
  onStep: (step: SearchStep) => void;
  onClose: () => void;
};

/**
 * Barre de recherche dans le fil : requête, compteur « 2 / 5 », navigation
 * entre résultats (boutons, Entrée = suivant plus ancien, Maj+Entrée =
 * précédent plus récent), Échap ferme.
 */
export function ThreadSearchBar({
  query,
  matchCount,
  position,
  onQueryChange,
  onStep,
  onClose,
}: ThreadSearchBarProps) {
  const hasQuery = query.trim().length > 0;
  const hasMatches = matchCount > 0;
  return (
    <div className={styles.searchBar} role="search">
      <input
        className={styles.searchInput}
        type="search"
        placeholder={chatCopy.searchMessagesHint}
        aria-label={chatCopy.searchMessagesHint}
        value={query}
        autoFocus
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          onStep(event.shiftKey ? "newer" : "older");
        }}
      />
      <span className={styles.searchMeta} aria-live="polite">
        {!hasQuery ? null : hasMatches ? (
          <>
            <span aria-hidden>{chatCopy.searchCounter(position, matchCount)}</span>
            <span className="sr-only">
              {chatCopy.searchCounterLabel(position, matchCount)}
            </span>
          </>
        ) : (
          chatCopy.searchNoMatch
        )}
      </span>
      <button
        type="button"
        className={styles.searchNavBtn}
        aria-label={chatCopy.searchOlder}
        title={chatCopy.searchOlder}
        disabled={!hasMatches}
        onClick={() => onStep("older")}
      >
        <ChatIcon name="chevronUp" size={16} />
      </button>
      <button
        type="button"
        className={styles.searchNavBtn}
        aria-label={chatCopy.searchNewer}
        title={chatCopy.searchNewer}
        disabled={!hasMatches}
        onClick={() => onStep("newer")}
      >
        <ChatIcon name="chevronDown" size={16} />
      </button>
      <button type="button" className={styles.searchClose} onClick={onClose}>
        {chatCopy.close}
      </button>
    </div>
  );
}
