"use client";

import styles from "../ChatThreadView.module.css";

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
        placeholder="Rechercher dans la discussion"
        value={query}
        autoFocus
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <span className={styles.searchMeta}>
        {query.trim()
          ? `${matchCount} résultat${matchCount > 1 ? "s" : ""}`
          : ""}
      </span>
      <button type="button" className={styles.searchClose} onClick={onClose}>
        Fermer
      </button>
    </div>
  );
}
