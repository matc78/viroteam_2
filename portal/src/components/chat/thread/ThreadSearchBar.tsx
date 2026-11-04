"use client";

import styles from "../ChatThreadView.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type ThreadSearchBarProps = {
  query: string;
  matchCount: number;
  onQueryChange: (query: string) => void;
  onClose: () => void;
};

/** Barre de recherche dans le fil (requête + nombre de résultats). */
export function ThreadSearchBar({
  query,
  matchCount,
  onQueryChange,
  onClose,
}: ThreadSearchBarProps) {
  return (
    <div className={styles.searchBar}>
      <input
        className={styles.searchInput}
        type="search"
        placeholder={chatCopy.searchMessagesHint}
        value={query}
        autoFocus
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <span className={styles.searchMeta}>
        {query.trim()
          ? chatCopy.searchResultsCount(matchCount)
          : ""}
      </span>
      <button type="button" className={styles.searchClose} onClick={onClose}>
        {chatCopy.close}
      </button>
    </div>
  );
}
